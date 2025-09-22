export function withPhotoDefaults(raw) {
  if (!raw) return raw
  const likesCount = typeof raw.likesCount === 'number' ? raw.likesCount : 0
  return { ...raw, likesCount }
}

export function normalizePhotoDoc(doc) {
  if (!doc) return null
  const data = typeof doc.data === 'function' ? doc.data() : doc
  const id = doc.id ?? data?.id
  return withPhotoDefaults({ id, ...data })
}

export function sortPhotosByLikes(list) {
  return [...(list || [])].sort((a, b) => {
    const likesA = a?.likesCount ?? 0
    const likesB = b?.likesCount ?? 0
    if (likesA !== likesB) return likesB - likesA
    return millis(b?.createdAt) - millis(a?.createdAt)
  })
}

function millis(ts) {
  if (!ts) return 0
  if (typeof ts === 'number') return ts
  if (typeof ts === 'string') {
    const v = Date.parse(ts)
    return Number.isNaN(v) ? 0 : v
  }
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') {
    const nanos = typeof ts.nanoseconds === 'number' ? ts.nanoseconds : 0
    return ts.seconds * 1000 + nanos / 1e6
  }
  return 0
}
