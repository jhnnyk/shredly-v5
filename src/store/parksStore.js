import { defineStore } from 'pinia'
import { db } from '../lib/firebase'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'

export const useParksStore = defineStore('parks', {
  state: () => ({
    query: '',
    parks: [],
    visited: JSON.parse(localStorage.getItem('visitedParks') || '[]'),
    unsub: null,
  }),
  getters: {
    visitedSet: (s) => new Set(s.visited),
    filteredParks: (s) => {
      const q = s.query.trim().toLowerCase()
      if(!q) return s.parks
      return s.parks.filter(p => {
        const hay = [p.name, p.city, p.state, (p.tags||[]).join(' ')].join(' ').toLowerCase()
        return hay.includes(q)
      })
    }
  },
  actions: {
    setQuery(q){ this.query = q },
    toggleVisited(id){
      const i = this.visited.indexOf(id)
      if(i >= 0) this.visited.splice(i,1)
      else this.visited.push(id)
      localStorage.setItem('visitedParks', JSON.stringify(this.visited))
    },
    start(){
      if(this.unsub) return
      try{
        const qref = query(collection(db, 'parks'), orderBy('name'))
        this.unsub = onSnapshot(qref, snap => {
          this.parks = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        }, err => {
          console.warn('onSnapshot parks failed; using demo data', err)
          this.useDemo()
        })
      } catch (e){
        console.warn('parks snapshot init failed', e)
        this.useDemo()
      }
    },
    useDemo(){
      this.parks = [
        { id:'denver-civic', name:'Civic Center Park', city:'Denver', state:'CO', lat:39.739, lng:-104.99, sizeSqft:20000, builder:'Dreamland', hours:'7am–10pm', tags:['indoor','lights','concrete'] },
        { id:'sunset-plaza', name:'Sunset Plaza', city:'Fort Collins', state:'CO', lat:40.585, lng:-105.084, sizeSqft:9400, builder:'Spohn Ranch', hours:'6am–10pm', tags:['street','prefab'] },
        { id:'ridge-line-bowl', name:'Ridge Line Bowl', city:'Golden', state:'CO', lat:39.755, lng:-105.221, sizeSqft:15800, builder:'Grindline', hours:'24 hours', tags:['bowl','lights','concrete'] },
      ]
    }
  }
})