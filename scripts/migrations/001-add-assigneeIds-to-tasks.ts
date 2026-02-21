/**
 * Migration: Add assigneeIds field to all existing tasks
 *
 * This migration adds `assigneeIds: []` to all tasks that lack the field.
 * Not strictly required (code treats undefined as []) but good for data consistency.
 *
 * Usage:
 *   npx tsx scripts/migrations/001-add-assigneeIds-to-tasks.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin (use service account or default credentials)
const app = initializeApp()
const db = getFirestore(app)

async function migrate() {
  console.log('Starting migration: add assigneeIds to tasks...')

  const tasksRef = db.collection('tasks')
  const snapshot = await tasksRef.get()

  let updated = 0
  let skipped = 0
  const batchSize = 500
  let batch = db.batch()
  let batchCount = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    if (data.assigneeIds === undefined) {
      batch.update(doc.ref, { assigneeIds: [] })
      updated++
      batchCount++

      if (batchCount >= batchSize) {
        await batch.commit()
        console.log(`  Committed batch of ${batchCount} updates`)
        batch = db.batch()
        batchCount = 0
      }
    } else {
      skipped++
    }
  }

  if (batchCount > 0) {
    await batch.commit()
    console.log(`  Committed final batch of ${batchCount} updates`)
  }

  console.log(`Migration complete: ${updated} tasks updated, ${skipped} skipped`)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
