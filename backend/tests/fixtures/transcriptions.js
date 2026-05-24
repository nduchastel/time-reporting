// tests/fixtures/transcriptions.js

export const GOOD_TRANSCRIPTIONS = {
  simpleHours: {
    text: "I worked 8 hours at Simons Property",
    expected: {
      action_type: "HOURS",
      hours: 8,
      worksite: "Simons Property",
      confidence: "high"
    }
  },

  checkIn: {
    text: "I just arrived at ACME Construction on Main Street",
    expected: {
      action_type: "IN",
      worksite: "ACME Construction",
      confidence: "high"
    }
  },

  checkOut: {
    text: "Leaving Hyatt now",
    expected: {
      action_type: "OUT",
      worksite: "Hyatt",
      confidence: "high"
    }
  },

  timeOff: {
    text: "I'm taking tomorrow off",
    expected: {
      action_type: "OFF",
      confidence: "high"
    }
  },

  backdated: {
    text: "Yesterday I worked 10 hours at Johnston site",
    expected: {
      action_type: "HOURS",
      hours: 10,
      worksite: "Johnston site",
      date_offset: -1,
      confidence: "high"
    }
  },

  withTimes: {
    text: "I arrived at 7:30 AM and left at 3:30 PM at Simons",
    expected: {
      action_type: "HOURS",
      start_time: "07:30",
      end_time: "15:30",
      hours: 8,
      worksite: "Simons",
      confidence: "high"
    }
  }
};

export const BAD_TRANSCRIPTIONS = {
  garbledSite: {
    text: "I worked 8 hours at Simmons Simmons Property",
    expected: {
      action_type: "HOURS",
      hours: 8,
      worksite: "Simmons Simmons Property",
      confidence: "medium"
    }
  },

  unclearHours: {
    text: "I worked uh maybe like 8 or 9 hours at Simons",
    expected: {
      action_type: "HOURS",
      hours: null,
      worksite: "Simons",
      confidence: "low"
    }
  },

  missingInfo: {
    text: "I worked at the site",
    expected: {
      action_type: "HOURS",
      hours: null,
      worksite: null,
      confidence: "low"
    }
  },

  conflictingInfo: {
    text: "I worked 8 hours no wait 10 hours at Simons",
    expected: {
      action_type: "HOURS",
      hours: 10,
      worksite: "Simons",
      confidence: "medium"
    }
  },

  ambiguousWorker: {
    text: "Bob and I worked 4 hours at Hyatt",
    expected: {
      action_type: "HOURS",
      hours: 4,
      worksite: "Hyatt",
      additional_workers: ["Bob"],
      confidence: "medium"
    }
  },

  vagueDate: {
    text: "I worked last Tuesday",
    expected: {
      action_type: "HOURS",
      hours: null,
      worksite: null,
      confidence: "low"
    }
  }
};

export const EDGE_CASES = {
  longRambling: {
    text: "So yeah I got to Simons around 7 or maybe 7:30 and worked all day with Bob doing road repair and then we had lunch and finished around 4",
    expected: {
      action_type: "HOURS",
      start_time: "07:30",
      end_time: "16:00",
      hours: 8.5,
      worksite: "Simons",
      additional_workers: ["Bob"],
      confidence: "medium"
    }
  },

  backgroundNoise: {
    text: "I worked [NOISE] hours at [INAUDIBLE] Property",
    expected: {
      action_type: "HOURS",
      hours: null,
      worksite: "[INAUDIBLE] Property",
      confidence: "low"
    }
  },

  mixedLanguage: {
    text: "Je worked 8 hours at Simons aujourd'hui",
    expected: {
      action_type: "HOURS",
      hours: 8,
      worksite: "Simons",
      confidence: "medium"
    }
  },

  noWork: {
    text: "I didn't work today because of weather",
    expected: {
      action_type: "OFF",
      confidence: "high"
    }
  },

  emergency: {
    text: "Emergency call - worked 20 hours straight at Simons water main break",
    expected: {
      action_type: "HOURS",
      hours: 20,
      worksite: "Simons",
      confidence: "high",
      notes: "Emergency - water main break"
    }
  }
};
