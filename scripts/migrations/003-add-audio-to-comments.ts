/**
 * Migration: Add audio fields to task comments
 *
 * This migration adds `audioUrl: null` and `audioDuration: 0` to all existing
 * taskComments documents that are missing these fields.
 * Backward compatible — code treats `undefined`/`null` as no audio.
 *
 * Usage:
 *   npx tsx scripts/migrations/003-add-audio-to-comments.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const app = initializeApp()
const db = getFirestore(app)

async function migrate() {
  console.log('Starting migration: add audio fields to taskComments...')

  const snapshot = await db.collection('taskComments').get()

  if (snapshot.empty) {
    console.log('No taskComments documents found, nothing to migrate')
    return
  }

  let updated = 0
  let skipped = 0

  const batch = db.batch()

  for (const doc of snapshot.docs) {
    const data = doc.data()
    if (data.audioUrl === undefined && data.audioDuration === undefined) {
      batch.update(doc.ref, {
        audioUrl: null,
        audioDuration: 0,
      })
      updated++
    } else {
      skipped++
    }
  }

  if (updated > 0) {
    await batch.commit()
  }

  console.log(`Migration complete: ${updated} updated, ${skipped} skipped`)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
