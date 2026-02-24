import { UUIDS } from './uuids';

/**
 * Valid request payload templates for contract tests.
 * These represent the canonical request formats as defined in the API contract.
 */

export const VALID_PAYLOADS = {
  createTask: {
    preventiveWithVehicles: {
      title: 'Contract Test - Oil Change',
      maintenanceType: 'preventive',
      triggerMode: 'mileage',
      triggerKm: 5000,
      triggerDate: '2025-06-01',
      remindBeforeKm: 500,
      remindBeforeDays: 7,
      notes: 'Use synthetic oil',
      vehicles: [
        {
          vehicleId: UUIDS.vehicles.V1,
          dueOdometerKm: 50000,
          dueDate: '2025-06-01',
        },
      ],
      checklist: [
        { jobCode: 'OIL001', label: 'Drain old oil', sortOrder: 1 },
        { jobCode: 'OIL002', label: 'Replace filter', sortOrder: 2 },
        { jobCode: 'OIL003', label: 'Add new oil', sortOrder: 3 },
      ],
    },
    correctiveMinimal: {
      title: 'Contract Test - Emergency Repair',
      maintenanceType: 'corrective',
    },
    preventiveMinimal: {
      title: 'Contract Test - Preventive Minimal',
      maintenanceType: 'preventive',
    },
    withSelectionContext: {
      title: 'Contract Test - With Context',
      maintenanceType: 'preventive',
      sourceGroupId: UUIDS.tasks.TASK_1,
      selectionContext: { fleetId: 'fleet-123', region: 'MENA' },
    },
  },

  addVehicles: {
    single: {
      vehicles: [
        {
          vehicleId: UUIDS.vehicles.V2,
          dueOdometerKm: 60000,
          dueDate: '2025-07-01',
        },
      ],
    },
    multiple: {
      vehicles: [
        { vehicleId: UUIDS.vehicles.V3, dueOdometerKm: 70000 },
        { vehicleId: UUIDS.vehicles.V4, dueDate: '2025-08-01' },
      ],
    },
    minimal: {
      vehicles: [{ vehicleId: UUIDS.vehicles.V5 }],
    },
  },

  completeVehicle: {
    withMasterWorkshop: {
      completionDate: '2025-01-15',
      actualOdometerKm: 50500,
      workshop: {
        mode: 'master',
        workshopId: UUIDS.workshops.SYSTEM_MAIN,
      },
      cost: {
        amount: 150,
        currency: 'EGP',
      },
      jobs: [
        { jobCode: 'OIL001', status: 'done' },
        { jobCode: 'OIL002', status: 'done' },
        { jobCode: 'OIL003', status: 'done' },
      ],
    },
    withCustomWorkshop: {
      completionDate: '2025-01-16',
      actualOdometerKm: 51000,
      workshop: {
        mode: 'custom',
        customName: 'Quick Fix Garage',
      },
      cost: {
        amount: 200,
        currency: 'EGP',
      },
    },
    minimal: {
      completionDate: '2025-01-17',
      actualOdometerKm: 52000,
      workshop: {
        mode: 'custom',
        customName: 'Test Workshop',
      },
      cost: {
        amount: 100,
        currency: 'EGP',
      },
    },
  },

  cancelVehicle: {
    withMasterReason: {
      date: '2025-01-15',
      actualOdometerKm: 49000,
      cancellationReason: {
        mode: 'master',
        reasonId: UUIDS.reasons.SYSTEM_SOLD,
      },
    },
    withCustomReason: {
      date: '2025-01-16',
      actualOdometerKm: 49500,
      cancellationReason: {
        mode: 'custom',
        customReason: 'Budget constraints',
      },
    },
  },

  rescheduleVehicle: {
    standard: {
      originalDate: '2025-01-15',
      newScheduledDate: '2025-02-15',
      rescheduleOdometerKm: 48000,
      rescheduleReason: {
        mode: 'custom',
        customReason: 'Parts not available',
      },
    },
  },

  correction: {
    costCorrection: {
      correctionReason: 'Cost was incorrectly recorded',
      patch: {
        costAmount: 200,
        costCurrency: 'EGP',
      },
    },
    dateCorrection: {
      correctionReason: 'Completion date was wrong',
      patch: {
        completionDate: '2025-01-20',
      },
    },
    workshopCorrection: {
      correctionReason: 'Wrong workshop selected',
      patch: {
        workshopCustom: 'Correct Workshop Name',
      },
    },
  },

  createWorkshop: {
    standard: {
      name: 'Contract Test Workshop',
      location: 'Cairo, Egypt',
    },
    minimal: {
      name: 'Minimal Workshop',
    },
  },

  createReason: {
    cancellation: {
      reasonType: 'cancellation',
      label: 'Contract Test Reason',
    },
  },

  updateWorkshop: {
    standard: {
      name: 'Updated Workshop Name',
      location: 'Updated Location',
    },
    nameOnly: {
      name: 'Name Only Update',
    },
    statusOnly: {
      status: 'inactive',
    },
  },

  updateReason: {
    standard: {
      label: 'Updated Reason Label',
    },
    statusOnly: {
      status: 'inactive',
    },
  },

  createAttachment: {
    receipt: {
      fileUrl: 'https://storage.example.com/receipts/invoice.pdf',
      fileType: 'receipt',
      fileName: 'invoice.pdf',
      contentType: 'application/pdf',
    },
    photo: {
      fileUrl: 'https://storage.example.com/photos/before.jpg',
      fileType: 'photo',
      fileName: 'before.jpg',
      contentType: 'image/jpeg',
    },
    minimal: {
      fileUrl: 'https://storage.example.com/docs/file.pdf',
      fileType: 'document',
    },
  },
};

export const INVALID_PAYLOADS = {
  createTask: {
    missingTitle: {
      maintenanceType: 'preventive',
    },
    missingMaintenanceType: {
      title: 'Test Task',
    },
    invalidMaintenanceType: {
      title: 'Test Task',
      maintenanceType: 'invalid',
    },
    negativeTriggerKm: {
      title: 'Test Task',
      maintenanceType: 'preventive',
      triggerKm: -100,
    },
    nonWhitelisted: {
      title: 'Test Task',
      maintenanceType: 'preventive',
      unknownField: 'should be rejected',
    },
    emptyChecklist: {
      title: 'Test Task',
      maintenanceType: 'preventive',
      checklist: [],
    },
    invalidVehicleId: {
      title: 'Test Task',
      maintenanceType: 'preventive',
      vehicles: [{ vehicleId: 'not-an-integer' }],
    },
  },

  addVehicles: {
    emptyArray: {
      vehicles: [],
    },
    invalidVehicleId: {
      vehicles: [{ vehicleId: 'not-an-integer' }],
    },
    missingVehicles: {},
  },

  completeVehicle: {
    missingCompletionDate: {
      actualOdometerKm: 50000,
      workshop: { mode: 'custom', customName: 'Test' },
      cost: { amount: 100, currency: 'EGP' },
    },
    missingActualOdometer: {
      completionDate: '2025-01-15',
      workshop: { mode: 'custom', customName: 'Test' },
      cost: { amount: 100, currency: 'EGP' },
    },
    missingWorkshop: {
      completionDate: '2025-01-15',
      actualOdometerKm: 50000,
      cost: { amount: 100, currency: 'EGP' },
    },
    missingCost: {
      completionDate: '2025-01-15',
      actualOdometerKm: 50000,
      workshop: { mode: 'custom', customName: 'Test' },
    },
    invalidWorkshopMode: {
      completionDate: '2025-01-15',
      actualOdometerKm: 50000,
      workshop: { mode: 'invalid' },
      cost: { amount: 100, currency: 'EGP' },
    },
    masterModeMissingId: {
      completionDate: '2025-01-15',
      actualOdometerKm: 50000,
      workshop: { mode: 'master' },
      cost: { amount: 100, currency: 'EGP' },
    },
    customModeMissingName: {
      completionDate: '2025-01-15',
      actualOdometerKm: 50000,
      workshop: { mode: 'custom' },
      cost: { amount: 100, currency: 'EGP' },
    },
  },

  cancelVehicle: {
    missingDate: {
      actualOdometerKm: 49000,
      cancellationReason: { mode: 'custom', customReason: 'Test' },
    },
    missingActualOdometer: {
      date: '2025-01-15',
      cancellationReason: { mode: 'custom', customReason: 'Test' },
    },
    missingCancellationReason: {
      date: '2025-01-15',
      actualOdometerKm: 49000,
    },
    masterModeMissingId: {
      date: '2025-01-15',
      actualOdometerKm: 49000,
      cancellationReason: { mode: 'master' },
    },
  },

  rescheduleVehicle: {
    missingOriginalDate: {
      newScheduledDate: '2025-02-15',
      rescheduleOdometerKm: 48000,
      rescheduleReason: { mode: 'custom', customReason: 'Test' },
    },
    missingNewScheduledDate: {
      originalDate: '2025-01-15',
      rescheduleOdometerKm: 48000,
      rescheduleReason: { mode: 'custom', customReason: 'Test' },
    },
    missingOdometer: {
      originalDate: '2025-01-15',
      newScheduledDate: '2025-02-15',
      rescheduleReason: { mode: 'custom', customReason: 'Test' },
    },
    missingReason: {
      originalDate: '2025-01-15',
      newScheduledDate: '2025-02-15',
      rescheduleOdometerKm: 48000,
    },
  },

  correction: {
    missingReason: {
      patch: { costAmount: 200 },
    },
    emptyPatch: {
      correctionReason: 'Test reason',
      patch: {},
    },
    missingPatch: {
      correctionReason: 'Test reason',
    },
  },

  createWorkshop: {
    missingName: {
      location: 'Test Location',
    },
  },

  updateWorkshop: {
    emptyBody: {},
    nonWhitelisted: {
      unknownField: 'x',
    },
  },

  updateReason: {
    emptyBody: {},
    nonWhitelisted: {
      unknownField: 'x',
    },
  },

  createReason: {
    missingReasonType: {
      label: 'Test Reason',
    },
    missingLabel: {
      reasonType: 'cancellation',
    },
    invalidReasonType: {
      reasonType: 'invalid',
      label: 'Test Reason',
    },
  },

  createAttachment: {
    missingFileUrl: {
      fileType: 'receipt',
    },
    invalidFileUrl: {
      fileUrl: 'not-a-url',
      fileType: 'receipt',
    },
    missingFileType: {
      fileUrl: 'https://example.com/file.pdf',
    },
  },
};
