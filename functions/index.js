// functions/index.js
const { onObjectFinalized } = require('firebase-functions/v2/storage')
const { setGlobalOptions } = require('firebase-functions/v2')
const logger = require('firebase-functions/logger')
const admin = require('firebase-admin')
const sharp = require('sharp')
const { v4: uuidv4 } = require('uuid')

setGlobalOptions({ region: 'us-central1', memory: '1GiB', timeoutSeconds: 540 })
admin.initializeApp()

const db = admin.firestore()
const storage = admin.storage()

const SIZES = [
  { key: 'sm', w: 512 },
  { key: 'md', w: 1024 },
  { key: 'lg', w: 1600 },
]

async function saveVariant(bucket, destPath, buf, contentType) {
  const token = uuidv4()
  const file = bucket.file(destPath)
  await file.save(buf, {
    contentType,
    metadata: {
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })
  // Firebase download URL (works with Storage Rules, no signBlob needed)
  return `https://firebasestorage.googleapis.com/v0/b/${
    bucket.name
  }/o/${encodeURIComponent(destPath)}?alt=media&token=${token}`
}

async function toSharpInput(origBuf, contentType) {
  // 1) If content-type hints HEIC, convert first
  const ct = (contentType || '').toLowerCase()
  const looksHeic = ct.includes('heic') || ct.includes('heif')
  if (looksHeic) {
    const { default: heicConvert } = await import('heic-convert')
    const jpegBuf = await heicConvert({
      buffer: origBuf,
      format: 'JPEG',
      quality: 0.92,
    })
    return sharp(jpegBuf).rotate().toColorspace('srgb')
  }

  // 2) Try sharp directly
  try {
    const s = sharp(origBuf, { failOn: 'none' }).rotate().toColorspace('srgb')
    await s.metadata() // force decode probe
    return s
  } catch (e) {
    // 3) Fallback HEIC->JPEG if sharp failed to decode
    logger.warn('sharp could not decode; falling back to heic-convert', {
      err: String(e),
    })
    const { default: heicConvert } = await import('heic-convert')
    const jpegBuf = await heicConvert({
      buffer: origBuf,
      format: 'JPEG',
      quality: 0.92,
    })
    return sharp(jpegBuf).rotate().toColorspace('srgb')
  }
}

exports.processPhoto = onObjectFinalized(async (event) => {
  const obj = event.data
  const filePath = obj?.name || ''
  const bucketName = obj?.bucket
  const contentType = obj?.contentType || ''
  logger.info('onFinalize', { bucketName, filePath, contentType })

  // Expect uploads/{uid}/{photoId}/original
  if (!filePath.startsWith('uploads/')) return

  const [, uid, photoId] = filePath.split('/')
  if (!uid || !photoId) return

  const photoRef = db.collection('photos').doc(photoId)
  const snap = await photoRef.get()
  if (!snap.exists) {
    logger.error('Photo doc missing', { photoId })
    return
  }
  const { parkId, userId } = snap.data() || {}
  if (!parkId || !userId) {
    logger.error('Missing parkId/userId', { photoId })
    return
  }

  await photoRef.set(
    {
      status: 'processing',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  const bucket = storage.bucket(bucketName)

  try {
    // Download original to buffer
    const [origBuf] = await bucket.file(filePath).download()

    // Get a sharp pipeline; fallback to HEIC->JPEG if needed
    const baseInput = await toSharpInput(origBuf, contentType)

    // Produce variants in-memory and save
    const outputs = {}
    for (const { key, w } of SIZES) {
      const base = baseInput
        .clone()
        .resize({ width: w, withoutEnlargement: true, fit: 'inside' })

      const webpBuf = await base.clone().webp({ quality: 82 }).toBuffer()
      const jpgBuf = await base
        .clone()
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()

      const destBase = `public/parks/${parkId}/photos/${photoId}/${key}`
      const webpUrl = await saveVariant(
        bucket,
        `${destBase}.webp`,
        webpBuf,
        'image/webp'
      )
      const jpgUrl = await saveVariant(
        bucket,
        `${destBase}.jpg`,
        jpgBuf,
        'image/jpeg'
      )
      outputs[key] = { webp: webpUrl, jpg: jpgUrl }
    }

    await photoRef.set(
      {
        status: 'ready',
        outputs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    // Optional: delete original to save space
    await bucket
      .file(filePath)
      .delete()
      .catch((e) => logger.warn('Delete original failed', { e: String(e) }))
  } catch (err) {
    logger.error('processPhoto failed', { err: String(err), filePath })
    await photoRef.set(
      {
        status: 'failed',
        error: String(err).slice(0, 500),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  }
})
