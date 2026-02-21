/**
 * Migration: Add vaultPasskey field to app settings
 *
 * This migration adds `vaultPasskey: null` to the settings/app_settings document.
 * When null, no passkey protection is active on vault entries.
 *
 * Usage:
 *   npx tsx scripts/migrations/002-add-vaultPasskey-to-settings.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const app = initializeApp()
const db = getFirestore(app)

const SETTINGS_DOC_ID = 'app_settings'

async function migrate() {
  console.log('Starting migration: add vaultPasskey to settings...')

  const docRef = db.collection('settings').doc(SETTINGS_DOC_ID)
  const docSnap = await docRef.get()

  if (!docSnap.exists) {
    console.log('Settings document does not exist, creating with vaultPasskey: null')
    await docRef.set({
      aiModel: 'gemini-3-flash-preview',
      aiEnabled: true,
      thinkingTimePercent: 0,
      vaultPasskey: null,
      updatedAt: new Date(),
    })
  } else {
    const data = docSnap.data()
    if (data?.vaultPasskey === undefined) {
      console.log('Adding vaultPasskey: null to existing settings')
      await docRef.update({ vaultPasskey: null })
    } else {
      console.log('vaultPasskey field already exists, skipping')
    }
  }

  console.log('Migration complete')
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
