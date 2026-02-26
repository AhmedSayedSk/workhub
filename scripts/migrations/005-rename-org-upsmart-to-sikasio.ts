/**
 * Migration: Rename organization from 'upsmart' to 'sikasio'
 *
 * This migration:
 * 1. Copies organizations/upsmart → organizations/sikasio (with name: 'Sikasio')
 * 2. Deletes organizations/upsmart
 * 3. Updates all systems where organizationId == 'upsmart' → 'sikasio'
 *
 * Usage:
 *   npx tsx scripts/migrations/005-rename-org-upsmart-to-sikasio.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const app = initializeApp()
const db = getFirestore(app)

async function migrate() {
  console.log('Starting migration: rename org upsmart → sikasio...')

  // 1. Read the old organization document
  const oldOrgRef = db.collection('organizations').doc('upsmart')
  const oldOrgDoc = await oldOrgRef.get()

  if (!oldOrgDoc.exists) {
    console.log('organizations/upsmart does not exist, checking if already migrated...')
    const newOrgDoc = await db.collection('organizations').doc('sikasio').get()
    if (newOrgDoc.exists) {
      console.log('organizations/sikasio already exists — migration already applied')
      return
    }
    console.log('Neither document exists — nothing to migrate')
    return
  }

  const orgData = oldOrgDoc.data()!

  // 2. Create the new organization document
  const newOrgRef = db.collection('organizations').doc('sikasio')
  await newOrgRef.set({
    ...orgData,
    name: 'Sikasio',
  })
  console.log('Created organizations/sikasio')

  // 3. Delete the old organization document
  await oldOrgRef.delete()
  console.log('Deleted organizations/upsmart')

  // 4. Update all systems referencing the old organizationId
  const systemsSnapshot = await db
    .collection('systems')
    .where('organizationId', '==', 'upsmart')
    .get()

  if (systemsSnapshot.empty) {
    console.log('No systems reference organizationId "upsmart"')
  } else {
    const batch = db.batch()
    let count = 0

    for (const doc of systemsSnapshot.docs) {
      batch.update(doc.ref, { organizationId: 'sikasio' })
      count++
    }

    await batch.commit()
    console.log(`Updated ${count} systems: organizationId → "sikasio"`)
  }

  console.log('Migration complete')
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
