/**
 * Migration: Add notification settings fields to app settings
 *
 * This migration adds notification preference fields to the settings/app_settings document:
 * - notifyTimerReminder: boolean (default true)
 * - timerReminderMinutes: number (default 120)
 * - notifyDeadlineAlerts: boolean (default true)
 * - deadlineAlertDays: number (default 3)
 * - notifyPaymentReminders: boolean (default true)
 *
 * Usage:
 *   npx tsx scripts/migrations/006-add-notification-settings.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const app = initializeApp()
const db = getFirestore(app)

const SETTINGS_DOC_ID = 'app_settings'

const NOTIFICATION_DEFAULTS = {
  notifyTimerReminder: true,
  timerReminderMinutes: 120,
  notifyDeadlineAlerts: true,
  deadlineAlertDays: 3,
  notifyPaymentReminders: true,
}

async function migrate() {
  console.log('Starting migration: add notification settings...')

  const docRef = db.collection('settings').doc(SETTINGS_DOC_ID)
  const docSnap = await docRef.get()

  if (!docSnap.exists) {
    console.log('Settings document does not exist, creating with notification defaults')
    await docRef.set({
      aiModel: 'gemini-3-flash-preview',
      aiEnabled: true,
      thinkingTimePercent: 0,
      vaultPasskey: null,
      ...NOTIFICATION_DEFAULTS,
      updatedAt: new Date(),
    })
  } else {
    const data = docSnap.data()
    const updates: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(NOTIFICATION_DEFAULTS)) {
      if (data?.[key] === undefined) {
        updates[key] = value
      }
    }

    if (Object.keys(updates).length > 0) {
      console.log('Adding notification fields:', Object.keys(updates).join(', '))
      await docRef.update(updates)
    } else {
      console.log('All notification fields already exist, skipping')
    }
  }

  console.log('Migration complete')
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
