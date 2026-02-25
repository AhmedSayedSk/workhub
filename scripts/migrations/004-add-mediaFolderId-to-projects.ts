/**
 * Migration: Add mediaFolderId to projects
 *
 * This migration adds `mediaFolderId: null` to all existing project documents
 * that are missing this field. Used by the project attachments feature to
 * auto-create media folders per project.
 *
 * Usage:
 *   npx tsx scripts/migrations/004-add-mediaFolderId-to-projects.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const app = initializeApp()
const db = getFirestore(app)

async function migrate() {
  console.log('Starting migration: add mediaFolderId to projects...')

  const snapshot = await db.collection('projects').get()

  if (snapshot.empty) {
    console.log('No project documents found, nothing to migrate')
    return
  }

  let updated = 0
  let skipped = 0

  const batch = db.batch()

  for (const doc of snapshot.docs) {
    const data = doc.data()
    if (data.mediaFolderId === undefined) {
      batch.update(doc.ref, {
        mediaFolderId: null,
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
