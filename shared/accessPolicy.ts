// UI query gating only. Server guards independently enforce these permissions.
export const accessPolicy: Record<string, 'public' | 'patient' | readonly string[]> = {
  "waitlist:forStaff": ["admin", "professional", "reception"],
  "waitlist:staffCredits": ["admin", "professional", "reception"],
  "waitlist:staffJoin": ["admin", "reception"],
  "waitlist:staffLeave": ["admin", "reception"],
  "waitlist:mine": "patient",
  "waitlist:slots": "patient",
  "waitlist:join": "patient",
  "waitlist:leave": "patient",
  "appointmentNotifications:problems": ["admin", "reception"],
  "appointmentNotifications:retry": ["admin", "reception"],
  "appointmentNotifications:scan": ["admin", "reception"],
  "clinic:getNotificationSettings": ["admin", "reception"],
  "clinic:getHealthInsuranceOptions": ["admin", "professional", "reception"],
  "clinic:updateHealthInsuranceOptions": ["admin"],
  "clinical:attachPosturalPhoto": ["admin", "professional"],
  "clinic:getAdminSettings": ["admin"],
  "portalAuth:changePassword": ["admin"],
  "audit:logAction": [
    "admin",
    "professional",
    "reception"
  ],
  "audit:listAuditLogs": [
    "admin",
    "professional"
  ],
  "availability:listRules": [
    "admin",
    "professional",
    "reception"
  ],
  "availability:saveRule": [
    "admin"
  ],
  "availability:deleteRule": [
    "admin"
  ],
  "availability:listOverrides": [
    "admin",
    "professional",
    "reception"
  ],
  "availability:saveOverride": [
    "admin"
  ],
  "availability:deleteOverride": [
    "admin"
  ],
  "availability:getAvailableSlotsForDate": [
    "admin",
    "professional",
    "reception"
  ],
  "bookingBuilder:getBookingConfig": "public",
  "bookingBuilder:updateBookingConfig": [
    "admin",
    "reception"
  ],
  "bookingBuilder:resetBookingConfigToDefault": [
    "admin",
    "reception"
  ],
  "bookingBuilder:listPublicAvailableSlots": "public",
  "bookingBuilder:listPublicPackages": "public",
  "bookingBuilder:submitPublicBooking": "public",
  "bookingBuilder:listPublicBookings": [
    "admin",
    "reception"
  ],
  "bookingBuilder:updatePublicBookingStatus": [
    "admin",
    "reception"
  ],
  "clinic:getSettings": "public",
  "clinic:generateUploadUrl": [
    "admin"
  ],
  "clinic:updateSettings": [
    "admin"
  ],
  "clinic:removeLogo": [
    "admin"
  ],
  "clinical:generateUploadUrl": [
    "admin",
    "professional"
  ],
  "clinical:getStorageUrl": [
    "admin",
    "professional"
  ],
  "clinical:getClinicalRecord": [
    "admin",
    "professional"
  ],
  "clinical:saveClinicalRecord": [
    "admin",
    "professional"
  ],
  "clinical:listEvolutions": [
    "admin",
    "professional"
  ],
  "clinical:addSoapEvolution": [
    "admin",
    "professional"
  ],
  "clinical:getPainEvolutionHistory": [
    "admin",
    "professional"
  ],
  "clinical:listAllClinicalOverview": [
    "admin",
    "professional"
  ],
  "clinical:updateSoapEvolution": [
    "admin",
    "professional"
  ],
  "clinical:deleteSoapEvolution": [
    "admin",
    "professional"
  ],
  "clinical:deleteClinicalRecord": [
    "admin",
    "professional"
  ],
  "clinical:listClinicalReports": [
    "admin",
    "professional"
  ],
  "clinical:getClinicalReport": [
    "admin",
    "professional"
  ],
  "clinical:createClinicalReport": [
    "admin",
    "professional"
  ],
  "clinical:updateClinicalReport": [
    "admin",
    "professional"
  ],
  "clinical:deleteClinicalReport": [
    "admin",
    "professional"
  ],
  "consents:getPatientConsents": [
    "admin",
    "professional"
  ],
  "consents:saveConsent": [
    "admin",
    "professional"
  ],
  "finance:listTransactions": [
    "admin"
  ],
  "finance:getCashFlowSummary": [
    "admin"
  ],
  "finance:createTransaction": [
    "admin"
  ],
  "finance:updateTransaction": [
    "admin"
  ],
  "finance:markTransactionPaid": [
    "admin"
  ],
  "finance:cancelTransaction": [
    "admin"
  ],
  "finance:deleteTransaction": [
    "admin"
  ],
  "finance:calculateProfessionalCommissions": [
    "admin"
  ],
  "finance:closeProfessionalCommission": [
    "admin"
  ],
  "finance:listCommissions": [
    "admin"
  ],
  "notifications:listLogs": [
    "admin",
    "reception"
  ],
  "notifications:getNotificationStats": [
    "admin",
    "reception"
  ],
  "notifications:sendWhatsAppNotificationAction": [
    "admin",
    "reception"
  ],
  "notifications:sendEmailNotificationAction": [
    "admin",
    "reception"
  ],
  "notifications:sendReceiptNotificationAction": [
    "admin",
    "reception"
  ],
  "notifications:triggerManualScanAction": [
    "admin",
    "reception"
  ],
  "notifications:testUazapiConnectionAction": [
    "admin",
    "reception"
  ],
  "notifications:testResendConnectionAction": [
    "admin",
    "reception"
  ],
  "notifications:sendWhatsAppReminder": [
    "admin",
    "reception"
  ],
  "notifications:sendEmailReceipt": [
    "admin",
    "reception"
  ],
  "packages:listServices": [
    "admin",
    "professional",
    "reception"
  ],
  "packages:listPackages": [
    "admin",
    "professional",
    "reception"
  ],
  "packages:createPackage": [
    "admin",
    "professional",
    "reception"
  ],
  "packages:updatePackage": [
    "admin",
    "professional",
    "reception"
  ],
  "packages:deletePackage": [
    "admin",
    "professional",
    "reception"
  ],
  "packages:deletePatientPackage": [
    "admin",
    "professional",
    "reception"
  ],
  "packages:listPatientPackages": [
    "admin",
    "professional",
    "reception"
  ],
  "packages:listRenewalAlerts": [
    "admin",
    "professional",
    "reception"
  ],
  "packages:assignPackageToPatient": [
    "admin",
    "professional",
    "reception"
  ],
  "patientPortal:getPatientPortalData": "patient",
  "patientPortal:cancelAppointmentByPatient": "patient",
  "patientPortal:rescheduleAppointmentByPatient": "patient",
  "patientPortal:useReplacementCreditToBook": "patient",
  "patientPortal:listAvailableSlotsForBooking": "patient",
  "patientPortal:bookAppointmentFromPortal": "patient",
  "patients:listPatients": [
    "admin",
    "professional",
    "reception"
  ],
  "patients:getPatient": [
    "admin",
    "professional",
    "reception"
  ],
  "patients:createPatient": [
    "admin",
    "professional",
    "reception"
  ],
  "patients:updatePatient": [
    "admin"
  ],
  "patients:deletePatient": [
    "admin"
  ],
  "professionals:listProfessionals": [
    "admin",
    "professional",
    "reception"
  ],
  "professionals:createProfessional": [
    "admin"
  ],
  "professionals:updateProfessional": [
    "admin"
  ],
  "professionals:deleteProfessional": [
    "admin"
  ],
  "rooms:listRooms": [
    "admin",
    "professional",
    "reception"
  ],
  "rooms:createRoom": [
    "admin"
  ],
  "rooms:updateRoom": [
    "admin"
  ],
  "rooms:deleteRoom": [
    "admin"
  ],
  "schedules:listSchedulesByDate": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:listSchedulesByDateRange": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:checkScheduleConflict": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:createSchedule": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:createRecurringScheduleSeries": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:addParticipantToSchedule": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:checkInParticipant": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:batchCheckInClass": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:cancelWithReplacementCredit": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:listAvailableReplacementCredits": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:listAvailableTurmasForReplacement": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:updateSchedule": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:deleteSchedule": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:removeParticipantFromSchedule": [
    "admin",
    "professional",
    "reception"
  ],
  "schedules:getAttendanceReport": [
    "admin",
    "professional",
    "reception"
  ],
  "services:listServices": [
    "admin",
    "professional",
    "reception"
  ],
  "services:getService": [
    "admin",
    "professional",
    "reception"
  ],
  "services:createService": [
    "admin"
  ],
  "services:updateService": [
    "admin"
  ],
  "services:deleteService": [
    "admin"
  ],
  "whatsapp:listInstances": [
    "admin"
  ],
  "whatsapp:setDefaultInstance": [
    "admin"
  ],
  "whatsapp:createInstanceAction": [
    "admin"
  ],
  "whatsapp:listServerInstancesAction": [
    "admin"
  ],
  "whatsapp:connectExistingTokenAction": [
    "admin"
  ],
  "whatsapp:checkInstanceStatusAction": [
    "admin"
  ],
  "whatsapp:getQrCodeAction": [
    "admin"
  ],
  "whatsapp:syncAllInstancesStatusAction": [
    "admin"
  ],
  "whatsapp:disconnectInstanceAction": [
    "admin"
  ],
  "whatsapp:deleteInstanceAction": [
    "admin"
  ],
  "whatsapp:listTemplates": ["admin", "reception"],
  "whatsapp:saveTemplate": ["admin", "reception"],
  "whatsapp:deleteTemplate": ["admin", "reception"],
  "whatsapp:assignReminderTemplate": ["admin", "reception"],
  "whatsapp:listBroadcastCampaigns": ["admin", "reception"],
  "whatsapp:createBroadcastCampaign": ["admin", "reception"],
  "whatsapp:toggleCampaignStatus": ["admin", "reception"],
  "whatsapp:deleteCampaign": ["admin", "reception"],
  "whatsapp:dispatchBroadcastCampaignAction": ["admin", "reception"]
}
