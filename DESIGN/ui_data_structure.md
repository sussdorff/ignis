# Patient Intake Form - UI Data Structure Specification

> **Agent Task:** Generate a comprehensive, type-safe patient intake form system for German medical practices (Praxen) using this specification as the source of truth.

---

## 🎯 Agent Instructions

You are building the patient intake form for **Ignis**, an AI-powered patient intake system for German medical practices. This form must:

1. **Support multiple data sources**: Voice AI (11 Labs), eGK (Gesundheitskarte), ePA (elektronische Patientenakte), paper forms, verbal input
2. **Handle progressive disclosure**: Show fields based on priority level and conditional logic
3. **Enable AI flagging**: Mark fields that are uncertain or need physician verification
4. **Support FHIR R4 mapping**: All data must map to FHIR resources (Patient, Condition, Observation, etc.)
5. **Be GDPR-compliant**: All consent fields must be explicit and auditable
6. **Support German locale**: Date formats (DD.MM.YYYY), phone (+49), postal codes (5 digits), insurance numbers

---

## 📊 Data Structure Schema

### Global Configuration

```typescript
interface FormConfig {
  version: string;                    // Semantic versioning (e.g., "1.0.0")
  locale: "de-DE" | "en-US";          // Primary locale
  defaultPriority: "critical" | "high" | "moderate" | "low";
  progressiveDisclosure: boolean;     // Show fields progressively by priority
  aiAssistedMode: boolean;            // Enable AI confidence scoring
  fhirMappingEnabled: boolean;        // Map to FHIR resources on submit
}
```

---

## 📋 Section 1: Administrative Data (CRITICAL)

**Purpose:** Patient identification and insurance verification. Required for all patients.

**FHIR Mapping:** `Patient` resource

```typescript
interface AdministrativeData {
  // Personal Information
  personalInfo: {
    salutation: {
      type: "select";
      options: ["Herr", "Frau", "Divers", "Keine Angabe"];
      required: true;
      fhirPath: "Patient.name.prefix";
    };
    firstName: {
      type: "string";
      required: true;
      maxLength: 100;
      placeholder: "Vorname";
      fhirPath: "Patient.name.given";
    };
    lastName: {
      type: "string";
      required: true;
      maxLength: 100;
      placeholder: "Nachname";
      fhirPath: "Patient.name.family";
    };
    birthName: {
      type: "string";
      required: false;
      placeholder: "Geburtsname (falls abweichend)";
      fhirPath: "Patient.name[use=maiden].family";
    };
    dateOfBirth: {
      type: "date";
      required: true;
      format: "DD.MM.YYYY";
      maxDate: "today";
      minDate: "1900-01-01";
      fhirPath: "Patient.birthDate";
    };
    gender: {
      type: "select";
      options: ["männlich", "weiblich", "divers", "unbekannt"];
      required: true;
      fhirPath: "Patient.gender";
      fhirValueMap: {
        "männlich": "male",
        "weiblich": "female",
        "divers": "other",
        "unbekannt": "unknown"
      };
    };
  };

  // Address
  address: {
    street: {
      type: "string";
      required: true;
      placeholder: "Straße und Hausnummer";
      fhirPath: "Patient.address.line";
    };
    postalCode: {
      type: "string";
      required: true;
      pattern: "^[0-9]{5}$";
      placeholder: "PLZ";
      validationMessage: "Bitte geben Sie eine gültige 5-stellige PLZ ein";
      fhirPath: "Patient.address.postalCode";
    };
    city: {
      type: "string";
      required: true;
      placeholder: "Stadt";
      fhirPath: "Patient.address.city";
    };
    country: {
      type: "string";
      default: "Deutschland";
      fhirPath: "Patient.address.country";
    };
  };

  // Contact
  contact: {
    phone: {
      type: "tel";
      required: true;
      pattern: "^\\+?[0-9\\s\\-\\/]+$";
      placeholder: "+49 xxx xxxxxxx";
      fhirPath: "Patient.telecom[system=phone]";
    };
    mobile: {
      type: "tel";
      required: false;
      pattern: "^\\+?[0-9\\s\\-\\/]+$";
      placeholder: "+49 1xx xxxxxxxx";
      fhirPath: "Patient.telecom[system=phone,use=mobile]";
    };
    email: {
      type: "email";
      required: false;
      placeholder: "email@beispiel.de";
      fhirPath: "Patient.telecom[system=email]";
    };
    preferredContactMethod: {
      type: "select";
      options: ["Telefon", "SMS", "E-Mail", "Post"];
      default: "Telefon";
    };
  };

  // Insurance Details
  insurance: {
    insuranceType: {
      type: "select";
      options: ["GKV", "PKV", "Beihilfe", "Selbstzahler", "BG", "Sonstige"];
      required: true;
      fhirPath: "Coverage.type";
      labels: {
        "GKV": "Gesetzliche Krankenversicherung",
        "PKV": "Private Krankenversicherung",
        "Beihilfe": "Beihilfe",
        "Selbstzahler": "Selbstzahler",
        "BG": "Berufsgenossenschaft",
        "Sonstige": "Sonstige"
      };
    };
    insurerName: {
      type: "string";
      required: true;
      placeholder: "Krankenkasse/Versicherung";
      autocomplete: true;  // Suggest from known German insurers
      fhirPath: "Coverage.payor.display";
    };
    insurerIKNumber: {
      type: "string";
      required: false;
      pattern: "^[0-9]{9}$";
      placeholder: "IK-Nummer (9-stellig)";
      conditionalOn: { field: "insuranceType", values: ["GKV"] };
    };
    insuranceNumber: {
      type: "string";
      required: true;
      placeholder: "Versichertennummer";
      fhirPath: "Coverage.subscriberId";
    };
    insuranceStatus: {
      type: "select";
      options: ["Mitglied", "Familienversichert", "Rentner"];
      conditionalOn: { field: "insuranceType", values: ["GKV"] };
    };
    kvkRead: {
      type: "boolean";
      default: false;
      label: "Daten von eGK eingelesen";
      readOnly: true;  // Set by system
    };
  };

  // Emergency Contact
  emergencyContact: {
    name: {
      type: "string";
      required: true;
      placeholder: "Name des Notfallkontakts";
      fhirPath: "Patient.contact.name";
    };
    relationship: {
      type: "select";
      options: ["Ehepartner/in", "Elternteil", "Kind", "Geschwister", "Freund/in", "Sonstige"];
      required: true;
      fhirPath: "Patient.contact.relationship";
    };
    phone: {
      type: "tel";
      required: true;
      placeholder: "+49 xxx xxxxxxx";
      fhirPath: "Patient.contact.telecom[system=phone]";
    };
  };
}
```

---

## 📋 Section 2: Medical History (HIGH PRIORITY)

**Purpose:** Capture existing conditions, surgeries, and family history for clinical context.

**FHIR Mapping:** `Condition`, `Procedure`, `FamilyMemberHistory`

```typescript
interface MedicalHistory {
  // Current Diagnoses
  currentDiagnoses: {
    type: "array";
    itemSchema: {
      diagnosis: {
        type: "string";
        required: true;
        placeholder: "Diagnose eingeben";
        autocomplete: "icd10";  // ICD-10 GM autocomplete
      };
      icdCode: {
        type: "string";
        pattern: "^[A-Z][0-9]{2}(\\.[0-9]{1,2})?$";
        placeholder: "ICD-10 Code (z.B. E11.9)";
        fhirPath: "Condition.code.coding[system=ICD-10-GM]";
      };
      diagnosisDate: {
        type: "date";
        required: false;
        placeholder: "Seit wann bekannt?";
        fhirPath: "Condition.onsetDateTime";
      };
      treatingPhysician: {
        type: "string";
        required: false;
        placeholder: "Behandelnder Arzt";
      };
      status: {
        type: "select";
        options: ["aktiv", "in Remission", "geheilt", "unbekannt"];
        default: "aktiv";
        fhirPath: "Condition.clinicalStatus";
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weitere Diagnose hinzufügen";
  };

  // Chronic Conditions (Quick Select)
  chronicConditions: {
    type: "multiselect";
    options: [
      "Diabetes mellitus Typ 1",
      "Diabetes mellitus Typ 2",
      "Bluthochdruck (Hypertonie)",
      "Koronare Herzkrankheit",
      "Herzinsuffizienz",
      "Vorhofflimmern",
      "COPD",
      "Asthma bronchiale",
      "Chronische Nierenerkrankung",
      "Osteoporose",
      "Rheumatoide Arthritis",
      "Depression",
      "Angststörung",
      "Epilepsie",
      "Multiple Sklerose",
      "Parkinson",
      "Schilddrüsenerkrankung",
      "Krebs (aktiv/in Nachsorge)"
    ];
    allowOther: true;
    otherPlaceholder: "Andere chronische Erkrankung...";
  };

  // Previous Surgeries
  previousSurgeries: {
    type: "array";
    itemSchema: {
      procedure: {
        type: "string";
        required: true;
        placeholder: "Operation/Eingriff";
        fhirPath: "Procedure.code.text";
      };
      date: {
        type: "date";
        required: false;
        placeholder: "Datum (ungefähr)";
        format: "MM.YYYY";  // Month/Year precision OK
        fhirPath: "Procedure.performedDateTime";
      };
      hospital: {
        type: "string";
        required: false;
        placeholder: "Krankenhaus/Klinik";
        fhirPath: "Procedure.location.display";
      };
      complications: {
        type: "textarea";
        required: false;
        placeholder: "Komplikationen (falls vorhanden)";
        maxLength: 500;
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weitere Operation hinzufügen";
  };

  // Family History
  familyHistory: {
    type: "array";
    itemSchema: {
      condition: {
        type: "string";
        required: true;
        placeholder: "Erkrankung";
        fhirPath: "FamilyMemberHistory.condition.code.text";
      };
      relationship: {
        type: "select";
        options: ["Mutter", "Vater", "Schwester", "Bruder", "Großmutter mütterlicherseits", "Großvater mütterlicherseits", "Großmutter väterlicherseits", "Großvater väterlicherseits", "Tante", "Onkel", "Kind"];
        required: true;
        fhirPath: "FamilyMemberHistory.relationship";
      };
      ageAtOnset: {
        type: "number";
        required: false;
        placeholder: "Alter bei Diagnose";
        min: 0;
        max: 120;
        fhirPath: "FamilyMemberHistory.condition.onsetAge";
      };
      deceased: {
        type: "boolean";
        default: false;
        label: "Verstorben an dieser Erkrankung";
        fhirPath: "FamilyMemberHistory.deceasedBoolean";
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weitere Familienanamnese hinzufügen";
    quickSelect: [
      "Herzinfarkt",
      "Schlaganfall",
      "Krebs (welche Art?)",
      "Diabetes",
      "Bluthochdruck"
    ];
  };
}
```

---

## 📋 Section 3: Current Symptoms (CRITICAL)

**Purpose:** Capture the reason for visit and current complaints. Essential for triage.

**FHIR Mapping:** `Condition` (chief complaint), `Observation` (symptoms)

**AI Triage Integration:** This section feeds into the 3-tier triage system (Emergency/Urgent/Regular)

```typescript
interface CurrentSymptoms {
  // Chief Complaint
  chiefComplaint: {
    type: "textarea";
    required: true;
    placeholder: "Was führt Sie heute zu uns? Beschreiben Sie Ihre Hauptbeschwerde...";
    maxLength: 1000;
    aiHint: "Extract primary symptom for triage classification";
    fhirPath: "Condition[category=encounter-diagnosis].code.text";
  };

  // Symptom Details
  symptomDetails: {
    onset: {
      type: "select";
      options: [
        "Gerade eben / Akut",
        "Heute",
        "Seit gestern",
        "Seit 2-3 Tagen",
        "Seit einer Woche",
        "Seit 2-4 Wochen",
        "Seit 1-3 Monaten",
        "Seit mehr als 3 Monaten",
        "Chronisch / Immer wieder"
      ];
      required: true;
      label: "Beginn der Beschwerden";
      aiHint: "Earlier onset with severity ≥7 increases urgency";
    };
    
    onsetDateTime: {
      type: "datetime";
      required: false;
      conditionalOn: { field: "onset", values: ["Gerade eben / Akut", "Heute"] };
      placeholder: "Genaue Uhrzeit (falls bekannt)";
    };

    duration: {
      type: "string";
      required: false;
      placeholder: "Wie lange dauert ein Anfall/Episode?";
      conditionalOn: { field: "onset", values: ["Chronisch / Immer wieder"] };
    };

    severity: {
      type: "range";
      min: 0;
      max: 10;
      step: 1;
      required: true;
      labels: {
        0: "Keine Schmerzen",
        5: "Mäßig",
        10: "Unerträglich"
      };
      label: "Schmerzstärke (0-10)";
      aiHint: "severity ≥ 8 triggers urgent classification";
      fhirPath: "Observation[code=pain-severity].valueInteger";
    };

    progression: {
      type: "select";
      options: [
        "Gleichbleibend",
        "Wird besser",
        "Wird schlimmer",
        "Kommt und geht",
        "Plötzlich aufgetreten"
      ];
      required: true;
      label: "Verlauf";
      aiHint: "'Wird schlimmer' increases urgency";
    };

    location: {
      type: "multiselect";
      options: [
        "Kopf",
        "Hals/Nacken",
        "Brust",
        "Bauch",
        "Rücken",
        "Arme",
        "Beine",
        "Gelenke",
        "Haut",
        "Ganzer Körper"
      ];
      allowOther: true;
      label: "Wo genau? (Mehrfachauswahl möglich)";
    };

    character: {
      type: "multiselect";
      options: [
        "Stechend",
        "Drückend",
        "Brennend",
        "Ziehend",
        "Pochend/Pulsierend",
        "Dumpf",
        "Krampfartig",
        "Ausstrahlend"
      ];
      allowOther: true;
      label: "Art der Beschwerden";
    };
  };

  // Aggravating & Relieving Factors
  factors: {
    aggravating: {
      type: "textarea";
      required: false;
      placeholder: "Was verschlimmert die Beschwerden? (z.B. Bewegung, Essen, Stress)";
      maxLength: 500;
    };
    relieving: {
      type: "textarea";
      required: false;
      placeholder: "Was lindert die Beschwerden? (z.B. Ruhe, Wärme, Medikamente)";
      maxLength: 500;
    };
  };

  // Associated Symptoms
  associatedSymptoms: {
    type: "multiselect";
    options: [
      "Fieber",
      "Schüttelfrost",
      "Übelkeit",
      "Erbrechen",
      "Durchfall",
      "Schwindel",
      "Kurzatmigkeit",
      "Herzrasen",
      "Schweißausbrüche",
      "Gewichtsverlust",
      "Müdigkeit/Erschöpfung",
      "Schlafstörungen",
      "Appetitlosigkeit"
    ];
    allowOther: true;
    label: "Begleitende Beschwerden";
    aiHint: "Fever + shortness of breath increases urgency";
  };

  // Previous Treatment Attempts
  previousTreatmentAttempts: {
    type: "textarea";
    required: false;
    placeholder: "Haben Sie bereits etwas versucht? (Medikamente, Hausmittel, Arztbesuch)";
    maxLength: 500;
    label: "Bisherige Behandlungsversuche";
  };

  // Emergency Red Flags (AI uses these for triage)
  redFlagSymptoms: {
    type: "multiselect";
    options: [
      "Brustschmerzen",
      "Atemnot in Ruhe",
      "Starke Blutung",
      "Bewusstseinsstörung",
      "Plötzliche Lähmung/Taubheit",
      "Sprachstörungen",
      "Starke Kopfschmerzen (Vernichtungskopfschmerz)",
      "Blut im Stuhl/Urin",
      "Suizidgedanken"
    ];
    required: false;
    label: "⚠️ Alarmsymptome (falls zutreffend)";
    aiHint: "CRITICAL: Any selection triggers emergency triage review";
    style: {
      backgroundColor: "#FEE2E2";
      borderColor: "#EF4444";
    };
  };
}
```

---

## 📋 Section 4: Medications (CRITICAL)

**Purpose:** Complete medication reconciliation for drug interactions and clinical safety.

**FHIR Mapping:** `MedicationStatement`

```typescript
interface Medications {
  // Current Prescription Medications
  prescriptionMedications: {
    type: "array";
    itemSchema: {
      name: {
        type: "string";
        required: true;
        placeholder: "Medikamentenname";
        autocomplete: "medication";  // PZN database autocomplete
        fhirPath: "MedicationStatement.medicationCodeableConcept.text";
      };
      pzn: {
        type: "string";
        required: false;
        pattern: "^[0-9]{8}$";
        placeholder: "PZN (8-stellig)";
        fhirPath: "MedicationStatement.medicationCodeableConcept.coding[system=PZN]";
      };
      dosage: {
        type: "string";
        required: true;
        placeholder: "z.B. 10mg, 500mg";
        fhirPath: "MedicationStatement.dosage.doseAndRate.doseQuantity";
      };
      frequency: {
        type: "select";
        options: [
          "1x täglich morgens",
          "1x täglich abends",
          "2x täglich",
          "3x täglich",
          "4x täglich",
          "Bei Bedarf",
          "Wöchentlich",
          "Monatlich",
          "Sonstiges"
        ];
        required: true;
        fhirPath: "MedicationStatement.dosage.timing";
      };
      frequencyOther: {
        type: "string";
        conditionalOn: { field: "frequency", values: ["Sonstiges"] };
        placeholder: "Bitte Einnahme beschreiben";
      };
      indication: {
        type: "string";
        required: false;
        placeholder: "Wofür? (z.B. Blutdruck, Diabetes)";
        fhirPath: "MedicationStatement.reasonCode.text";
      };
      prescribingPhysician: {
        type: "string";
        required: false;
        placeholder: "Verordnender Arzt";
        fhirPath: "MedicationStatement.informationSource.display";
      };
      startDate: {
        type: "date";
        required: false;
        placeholder: "Einnahme seit";
        fhirPath: "MedicationStatement.effectivePeriod.start";
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weiteres Medikament hinzufügen";
    importFromEPA: true;  // Can import from ePA if available
  };

  // OTC and Supplements
  otcAndSupplements: {
    type: "array";
    itemSchema: {
      name: {
        type: "string";
        required: true;
        placeholder: "Präparat/Nahrungsergänzung";
      };
      dosage: {
        type: "string";
        required: false;
        placeholder: "Dosierung";
      };
      frequency: {
        type: "string";
        required: false;
        placeholder: "Wie oft?";
      };
      reason: {
        type: "string";
        required: false;
        placeholder: "Wofür?";
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weiteres Präparat hinzufügen";
    examples: ["Vitamin D", "Magnesium", "Ibuprofen", "Aspirin", "Johanniskraut"];
  };

  // Medication Notes
  medicationNotes: {
    type: "textarea";
    required: false;
    placeholder: "Anmerkungen zu Medikamenten (z.B. Unverträglichkeiten, Nebenwirkungen, abgesetzte Medikamente)";
    maxLength: 500;
  };

  // Compliance Question
  medicationCompliance: {
    type: "select";
    options: [
      "Ja, regelmäßig wie verordnet",
      "Meistens, manchmal vergesse ich",
      "Unregelmäßig",
      "Nein, habe selbst abgesetzt"
    ];
    label: "Nehmen Sie Ihre Medikamente regelmäßig ein?";
    required: false;
  };
}
```

---

## 📋 Section 5: Allergies and Intolerances (CRITICAL)

**Purpose:** Document allergies to prevent adverse drug reactions. Safety-critical data.

**FHIR Mapping:** `AllergyIntolerance`

```typescript
interface AllergiesAndIntolerances {
  // Has Known Allergies
  hasKnownAllergies: {
    type: "select";
    options: ["Ja", "Nein", "Unbekannt"];
    required: true;
    label: "Haben Sie bekannte Allergien oder Unverträglichkeiten?";
  };

  // Drug Allergies
  drugAllergies: {
    type: "array";
    conditionalOn: { field: "hasKnownAllergies", values: ["Ja"] };
    itemSchema: {
      substance: {
        type: "string";
        required: true;
        placeholder: "Medikament/Wirkstoff";
        autocomplete: "medication";
        fhirPath: "AllergyIntolerance.code.text";
      };
      reaction: {
        type: "multiselect";
        options: [
          "Hautausschlag",
          "Juckreiz",
          "Schwellung",
          "Atemnot",
          "Übelkeit/Erbrechen",
          "Durchfall",
          "Anaphylaxie",
          "Sonstiges"
        ];
        required: true;
        label: "Art der Reaktion";
        fhirPath: "AllergyIntolerance.reaction.manifestation";
      };
      reactionOther: {
        type: "string";
        conditionalOn: { field: "reaction", contains: "Sonstiges" };
        placeholder: "Bitte beschreiben";
      };
      severity: {
        type: "select";
        options: ["leicht", "mittel", "schwer", "lebensbedrohlich"];
        required: true;
        label: "Schweregrad";
        fhirPath: "AllergyIntolerance.reaction.severity";
        fhirValueMap: {
          "leicht": "mild",
          "mittel": "moderate",
          "schwer": "severe",
          "lebensbedrohlich": "severe"
        };
      };
      status: {
        type: "select";
        options: ["Bestätigt", "Verdacht", "Widerlegt"];
        default: "Bestätigt";
        fhirPath: "AllergyIntolerance.verificationStatus";
      };
      lastOccurrence: {
        type: "date";
        required: false;
        placeholder: "Wann zuletzt aufgetreten?";
        fhirPath: "AllergyIntolerance.lastOccurrence";
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weitere Medikamentenallergie hinzufügen";
    aiFlag: "VERIFY_ALLERGY";  // Always flag for physician verification
  };

  // Food Allergies
  foodAllergies: {
    type: "array";
    conditionalOn: { field: "hasKnownAllergies", values: ["Ja"] };
    itemSchema: {
      food: {
        type: "string";
        required: true;
        placeholder: "Lebensmittel";
        fhirPath: "AllergyIntolerance.code.text";
      };
      reaction: {
        type: "string";
        required: true;
        placeholder: "Art der Reaktion";
      };
      severity: {
        type: "select";
        options: ["leicht", "mittel", "schwer", "lebensbedrohlich"];
        required: true;
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weitere Lebensmittelallergie hinzufügen";
    quickSelect: [
      "Nüsse",
      "Erdnüsse",
      "Milch/Laktose",
      "Eier",
      "Weizen/Gluten",
      "Soja",
      "Fisch",
      "Schalentiere"
    ];
  };

  // Other Allergies
  otherAllergies: {
    type: "array";
    conditionalOn: { field: "hasKnownAllergies", values: ["Ja"] };
    itemSchema: {
      allergen: {
        type: "string";
        required: true;
        placeholder: "Allergen";
      };
      category: {
        type: "select";
        options: ["Latex", "Kontrastmittel", "Pollen", "Tierhaare", "Insektengift", "Sonstiges"];
        required: true;
      };
      reaction: {
        type: "string";
        required: false;
        placeholder: "Reaktion";
      };
      severity: {
        type: "select";
        options: ["leicht", "mittel", "schwer", "lebensbedrohlich"];
        required: false;
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weitere Allergie hinzufügen";
    clinicalNote: "Latex- und Kontrastmittelallergien sind für Eingriffe besonders relevant";
  };

  // Allergy Summary Notes
  allergyNotes: {
    type: "textarea";
    required: false;
    placeholder: "Zusätzliche Informationen zu Allergien";
    maxLength: 500;
  };
}
```

---

## 📋 Section 6: Vaccinations (MODERATE PRIORITY)

**Purpose:** Immunization records for preventive care and outbreak management.

**FHIR Mapping:** `Immunization`

```typescript
interface Vaccinations {
  // Standard Vaccinations
  vaccinations: {
    type: "array";
    itemSchema: {
      vaccine: {
        type: "select";
        options: [
          "COVID-19",
          "Influenza (Grippe)",
          "Tetanus",
          "Diphtherie",
          "Pertussis (Keuchhusten)",
          "Polio",
          "Masern",
          "Mumps",
          "Röteln",
          "Hepatitis A",
          "Hepatitis B",
          "FSME (Zecken)",
          "Pneumokokken",
          "Meningokokken",
          "HPV",
          "Gürtelrose (Herpes Zoster)",
          "Sonstige"
        ];
        required: true;
        fhirPath: "Immunization.vaccineCode.text";
      };
      vaccineOther: {
        type: "string";
        conditionalOn: { field: "vaccine", values: ["Sonstige"] };
        placeholder: "Welche Impfung?";
      };
      date: {
        type: "date";
        required: false;
        placeholder: "Datum der letzten Impfung";
        fhirPath: "Immunization.occurrenceDateTime";
      };
      doseNumber: {
        type: "number";
        required: false;
        min: 1;
        max: 10;
        placeholder: "Dosis Nr. (z.B. 3 für 3. Impfung)";
        fhirPath: "Immunization.protocolApplied.doseNumberPositiveInt";
      };
      nextDueDate: {
        type: "date";
        required: false;
        placeholder: "Nächste Auffrischung fällig";
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weitere Impfung hinzufügen";
  };

  // Vaccination Certificate
  vaccinationCertificate: {
    hasDigitalCertificate: {
      type: "boolean";
      label: "Digitaler Impfnachweis vorhanden (z.B. CovPass)";
    };
    certificateUpload: {
      type: "file";
      accept: ["image/*", "application/pdf"];
      maxSizeMB: 10;
      label: "Impfpass hochladen (optional)";
      conditionalOn: { field: "hasDigitalCertificate", values: [false] };
    };
  };

  // Vaccination Notes
  vaccinationNotes: {
    type: "textarea";
    required: false;
    placeholder: "Anmerkungen (z.B. Impfreaktionen, fehlende Impfungen)";
    maxLength: 500;
  };
}
```

---

## 📋 Section 7: Previous Treatments (MODERATE PRIORITY)

**Purpose:** Track recent medical consultations and ongoing treatment plans.

**FHIR Mapping:** `Encounter`, `CarePlan`

```typescript
interface PreviousTreatments {
  // Recent Doctor Visits
  recentVisits: {
    type: "array";
    itemSchema: {
      specialty: {
        type: "select";
        options: [
          "Hausarzt/Allgemeinmedizin",
          "Internist",
          "Kardiologe",
          "Neurologe",
          "Orthopäde",
          "Chirurg",
          "HNO-Arzt",
          "Augenarzt",
          "Dermatologe",
          "Gynäkologe",
          "Urologe",
          "Psychiater/Psychotherapeut",
          "Zahnarzt",
          "Radiologe",
          "Krankenhaus/Notaufnahme",
          "Sonstiges"
        ];
        required: true;
        fhirPath: "Encounter.type.text";
      };
      physicianName: {
        type: "string";
        required: false;
        placeholder: "Name des Arztes/der Praxis";
        fhirPath: "Encounter.participant.individual.display";
      };
      date: {
        type: "date";
        required: false;
        placeholder: "Datum des Besuchs";
        fhirPath: "Encounter.period.start";
      };
      reason: {
        type: "string";
        required: false;
        placeholder: "Grund des Besuchs";
        fhirPath: "Encounter.reasonCode.text";
      };
      outcome: {
        type: "textarea";
        required: false;
        placeholder: "Ergebnis/Empfehlung";
        maxLength: 500;
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weiteren Arztbesuch hinzufügen";
    timeframe: "last 12 months";
  };

  // Current Treatment Plans
  currentTreatmentPlans: {
    type: "array";
    itemSchema: {
      title: {
        type: "string";
        required: true;
        placeholder: "Behandlungsplan (z.B. Physiotherapie, Chemotherapie)";
        fhirPath: "CarePlan.title";
      };
      provider: {
        type: "string";
        required: false;
        placeholder: "Behandelnde Einrichtung/Arzt";
      };
      startDate: {
        type: "date";
        required: false;
        placeholder: "Beginn";
        fhirPath: "CarePlan.period.start";
      };
      endDate: {
        type: "date";
        required: false;
        placeholder: "Ende (falls bekannt)";
        fhirPath: "CarePlan.period.end";
      };
      status: {
        type: "select";
        options: ["Aktiv", "Abgeschlossen", "Pausiert", "Geplant"];
        default: "Aktiv";
        fhirPath: "CarePlan.status";
      };
      notes: {
        type: "textarea";
        required: false;
        placeholder: "Details zum Behandlungsplan";
        maxLength: 500;
      };
    };
    minItems: 0;
    addButtonLabel: "+ Weiteren Behandlungsplan hinzufügen";
  };

  // Referral Letters
  referralLetters: {
    type: "array";
    itemSchema: {
      referringPhysician: {
        type: "string";
        required: true;
        placeholder: "Überweisender Arzt";
      };
      specialty: {
        type: "string";
        required: true;
        placeholder: "Fachrichtung der Überweisung";
      };
      date: {
        type: "date";
        required: false;
        placeholder: "Datum der Überweisung";
      };
      upload: {
        type: "file";
        accept: ["image/*", "application/pdf"];
        maxSizeMB: 10;
        label: "Überweisung hochladen";
      };
    };
    minItems: 0;
    addButtonLabel: "+ Überweisung hinzufügen";
  };
}
```

---

## 📋 Section 8: Diagnostic Documents (HIGH PRIORITY)

**Purpose:** Upload and track lab results, imaging studies, and medical reports.

**FHIR Mapping:** `DiagnosticReport`, `DocumentReference`

```typescript
interface DiagnosticDocuments {
  // Lab Results
  labResults: {
    type: "array";
    itemSchema: {
      testType: {
        type: "select";
        options: [
          "Blutbild",
          "Blutzucker/HbA1c",
          "Leber-/Nierenwerte",
          "Schilddrüsenwerte",
          "Cholesterin/Lipide",
          "Urinuntersuchung",
          "Stuhlprobe",
          "Abstrich",
          "Sonstiges"
        ];
        required: true;
        fhirPath: "DiagnosticReport.code.text";
      };
      testTypeOther: {
        type: "string";
        conditionalOn: { field: "testType", values: ["Sonstiges"] };
        placeholder: "Welche Untersuchung?";
      };
      date: {
        type: "date";
        required: true;
        placeholder: "Datum der Untersuchung";
        fhirPath: "DiagnosticReport.effectiveDateTime";
      };
      laboratory: {
        type: "string";
        required: false;
        placeholder: "Labor";
      };
      upload: {
        type: "file";
        accept: ["image/*", "application/pdf"];
        maxSizeMB: 20;
        multiple: true;
        label: "Befund hochladen";
        fhirPath: "DiagnosticReport.presentedForm";
      };
      notes: {
        type: "textarea";
        required: false;
        placeholder: "Auffällige Werte oder Anmerkungen";
        maxLength: 500;
      };
    };
    minItems: 0;
    addButtonLabel: "+ Laborbefund hinzufügen";
  };

  // Imaging Studies
  imagingStudies: {
    type: "array";
    itemSchema: {
      modality: {
        type: "select";
        options: [
          "Röntgen",
          "CT (Computertomographie)",
          "MRT (Magnetresonanztomographie)",
          "Ultraschall/Sonographie",
          "Mammographie",
          "Szintigraphie",
          "PET-CT",
          "Sonstiges"
        ];
        required: true;
        fhirPath: "ImagingStudy.modality";
      };
      bodyPart: {
        type: "string";
        required: true;
        placeholder: "Untersuchte Körperregion";
        fhirPath: "ImagingStudy.series.bodySite.display";
      };
      date: {
        type: "date";
        required: true;
        placeholder: "Datum der Untersuchung";
        fhirPath: "ImagingStudy.started";
      };
      facility: {
        type: "string";
        required: false;
        placeholder: "Krankenhaus/Radiologie";
      };
      finding: {
        type: "textarea";
        required: false;
        placeholder: "Hauptbefund (falls bekannt)";
        maxLength: 1000;
      };
      upload: {
        type: "file";
        accept: ["image/*", "application/pdf", "application/dicom"];
        maxSizeMB: 50;
        multiple: true;
        label: "Bilder/Befund hochladen";
      };
    };
    minItems: 0;
    addButtonLabel: "+ Bildgebung hinzufügen";
  };

  // Hospital Reports
  hospitalReports: {
    type: "array";
    itemSchema: {
      reportType: {
        type: "select";
        options: [
          "Entlassungsbrief",
          "Operationsbericht",
          "Arztbrief",
          "Befundbericht",
          "Sonstiges"
        ];
        required: true;
        fhirPath: "DocumentReference.type";
      };
      hospital: {
        type: "string";
        required: false;
        placeholder: "Krankenhaus/Praxis";
      };
      date: {
        type: "date";
        required: true;
        placeholder: "Datum";
        fhirPath: "DocumentReference.date";
      };
      upload: {
        type: "file";
        accept: ["image/*", "application/pdf"];
        maxSizeMB: 20;
        multiple: true;
        label: "Dokument hochladen";
        fhirPath: "DocumentReference.content.attachment";
      };
      summary: {
        type: "textarea";
        required: false;
        placeholder: "Zusammenfassung (falls kein Upload)";
        maxLength: 2000;
      };
    };
    minItems: 0;
    addButtonLabel: "+ Bericht hinzufügen";
  };
}
```

---

## 📋 Section 9: Social and Lifestyle (MODERATE PRIORITY)

**Purpose:** Capture social determinants of health and lifestyle factors.

**FHIR Mapping:** `Observation` (social history)

```typescript
interface SocialAndLifestyle {
  // Occupation
  occupation: {
    jobTitle: {
      type: "string";
      required: false;
      placeholder: "Beruf";
      fhirPath: "Observation[code=occupation].valueString";
    };
    workStatus: {
      type: "select";
      options: [
        "Vollzeit berufstätig",
        "Teilzeit berufstätig",
        "Selbstständig",
        "Arbeitslos",
        "Rentner/Pensionär",
        "Student/Auszubildender",
        "Hausfrau/Hausmann",
        "Erwerbsminderungsrente",
        "Arbeitsunfähig"
      ];
      required: false;
    };
    occupationalHazards: {
      type: "multiselect";
      options: [
        "Schwere körperliche Arbeit",
        "Bildschirmarbeit",
        "Lärm",
        "Chemikalien/Gefahrstoffe",
        "Staub/Feinstaub",
        "Nachtarbeit/Schichtdienst",
        "Keine besonderen Belastungen"
      ];
      allowOther: true;
      label: "Arbeitsbelastungen";
    };
  };

  // Living Situation
  livingSituation: {
    type: "select";
    options: [
      "Alleinlebend",
      "Mit Partner/Familie",
      "Betreutes Wohnen",
      "Pflegeheim",
      "Wohngemeinschaft",
      "Bei Angehörigen",
      "Sonstiges"
    ];
    required: false;
    fhirPath: "Observation[code=living-situation].valueCodeableConcept.text";
  };

  // Smoking
  smoking: {
    status: {
      type: "select";
      options: [
        "Nie geraucht",
        "Raucher (aktuell)",
        "Ex-Raucher",
        "Gelegentlicher Raucher"
      ];
      required: true;
      fhirPath: "Observation[code=smoking-status].valueCodeableConcept";
    };
    cigarettesPerDay: {
      type: "number";
      conditionalOn: { field: "status", values: ["Raucher (aktuell)", "Gelegentlicher Raucher"] };
      placeholder: "Zigaretten pro Tag";
      min: 0;
      max: 100;
    };
    yearsSmoked: {
      type: "number";
      conditionalOn: { field: "status", values: ["Raucher (aktuell)", "Ex-Raucher"] };
      placeholder: "Anzahl Jahre geraucht";
      min: 0;
      max: 100;
    };
    packYears: {
      type: "number";
      computed: true;  // Auto-calculated: (cigarettesPerDay / 20) * yearsSmoked
      label: "Pack Years";
      fhirPath: "Observation[code=pack-years].valueQuantity";
    };
    quitDate: {
      type: "date";
      conditionalOn: { field: "status", values: ["Ex-Raucher"] };
      placeholder: "Aufgehört seit";
    };
  };

  // Alcohol
  alcohol: {
    consumption: {
      type: "select";
      options: [
        "Kein Alkohol",
        "Gelegentlich (weniger als 1x/Woche)",
        "Regelmäßig (1-3x/Woche)",
        "Häufig (mehr als 3x/Woche)",
        "Täglich"
      ];
      required: false;
      fhirPath: "Observation[code=alcohol-use].valueCodeableConcept";
    };
    unitsPerWeek: {
      type: "number";
      conditionalOn: { field: "consumption", values: ["Regelmäßig (1-3x/Woche)", "Häufig (mehr als 3x/Woche)", "Täglich"] };
      placeholder: "Standardgläser pro Woche";
      min: 0;
      max: 100;
      helperText: "1 Standardglas = 0,3l Bier, 0,1l Wein, 2cl Schnaps";
    };
  };

  // Physical Activity
  physicalActivity: {
    level: {
      type: "select";
      options: [
        "Keine körperliche Aktivität",
        "Leichte Aktivität (Spazieren)",
        "Moderate Aktivität (1-2x/Woche Sport)",
        "Regelmäßige Aktivität (3-5x/Woche Sport)",
        "Intensive Aktivität (täglich Sport/Leistungssport)"
      ];
      required: false;
      fhirPath: "Observation[code=physical-activity].valueCodeableConcept";
    };
    limitations: {
      type: "textarea";
      required: false;
      placeholder: "Einschränkungen bei körperlicher Aktivität?";
      maxLength: 500;
    };
  };

  // Diet
  diet: {
    type: "multiselect";
    options: [
      "Keine besonderen Einschränkungen",
      "Vegetarisch",
      "Vegan",
      "Glutenfrei",
      "Laktosefrei",
      "Diabetikerdiät",
      "Natriumarm",
      "Sonstiges"
    ];
    allowOther: true;
    label: "Ernährungsbesonderheiten";
  };

  // Social Support
  socialSupport: {
    type: "select";
    options: [
      "Gute soziale Unterstützung",
      "Begrenzte Unterstützung",
      "Keine Unterstützung",
      "Pflegebedürftig (Pflegestufe vorhanden)"
    ];
    required: false;
  };

  // Mobility
  mobility: {
    type: "select";
    options: [
      "Uneingeschränkt mobil",
      "Gehhilfe erforderlich",
      "Rollstuhl",
      "Bettlägerig"
    ];
    required: false;
    fhirPath: "Observation[code=mobility].valueCodeableConcept";
  };
}
```

---

## 📋 Section 10: Consent and Legal (CRITICAL)

**Purpose:** Collect legally required consents for data processing, ePA access, and communication.

**FHIR Mapping:** `Consent`

```typescript
interface ConsentAndLegal {
  // GDPR Data Processing Consent
  gdprConsent: {
    dataProcessing: {
      type: "boolean";
      required: true;
      label: "Ich stimme der Verarbeitung meiner Gesundheitsdaten gemäß DSGVO Art. 9 zu.";
      validationMessage: "Die Zustimmung zur Datenverarbeitung ist erforderlich";
      fhirPath: "Consent.provision.type";
      legalText: `
        Ihre Gesundheitsdaten werden ausschließlich zum Zweck Ihrer medizinischen 
        Versorgung verarbeitet und gespeichert. Die Daten werden nicht an Dritte 
        weitergegeben, außer wenn dies für Ihre Behandlung erforderlich ist oder 
        Sie ausdrücklich einwilligen.
      `;
    };
    privacyPolicyAccepted: {
      type: "boolean";
      required: true;
      label: "Ich habe die Datenschutzerklärung gelesen und akzeptiere diese.";
      link: "/datenschutz";
    };
    timestamp: {
      type: "datetime";
      readOnly: true;
      autoFill: "now";
      fhirPath: "Consent.dateTime";
    };
  };

  // ePA Access Consent
  epaConsent: {
    hasEpa: {
      type: "select";
      options: ["Ja", "Nein", "Weiß nicht"];
      label: "Haben Sie eine elektronische Patientenakte (ePA)?";
    };
    grantAccess: {
      type: "boolean";
      conditionalOn: { field: "hasEpa", values: ["Ja"] };
      label: "Ich erlaube dieser Praxis Zugriff auf meine ePA.";
      fhirPath: "Consent.provision.actor.role";
    };
    accessPin: {
      type: "string";
      conditionalOn: { field: "grantAccess", values: [true] };
      placeholder: "ePA-Zugriffs-PIN";
      inputMode: "password";
      pattern: "^[0-9]{6}$";
      helperText: "6-stellige PIN für den Praxis-Zugriff";
    };
  };

  // Communication Preferences
  communicationPreferences: {
    allowSMS: {
      type: "boolean";
      default: true;
      label: "SMS-Benachrichtigungen erlaubt (Terminerinnerungen)";
    };
    allowEmail: {
      type: "boolean";
      default: false;
      label: "E-Mail-Kommunikation erlaubt";
    };
    allowPhone: {
      type: "boolean";
      default: true;
      label: "Telefonische Kontaktaufnahme erlaubt";
    };
    allowVoiceMail: {
      type: "boolean";
      default: true;
      label: "Nachricht auf Anrufbeantworter erlaubt";
    };
    thirdPartyDisclosure: {
      type: "boolean";
      default: false;
      label: "Befunde dürfen an Angehörige mitgeteilt werden";
    };
    thirdPartyName: {
      type: "string";
      conditionalOn: { field: "thirdPartyDisclosure", values: [true] };
      placeholder: "Name der berechtigten Person";
    };
  };

  // Digital Signature
  digitalSignature: {
    type: "signature";
    required: true;
    label: "Unterschrift des Patienten/Bevollmächtigten";
    canvasWidth: 400;
    canvasHeight: 150;
    fhirPath: "Consent.verification.verifiedWith";
  };

  // Signatory Information (if not patient)
  signatory: {
    isPatient: {
      type: "boolean";
      default: true;
      label: "Patient unterschreibt selbst";
    };
    name: {
      type: "string";
      conditionalOn: { field: "isPatient", values: [false] };
      required: true;
      placeholder: "Name des Bevollmächtigten";
    };
    relationship: {
      type: "select";
      conditionalOn: { field: "isPatient", values: [false] };
      options: ["Elternteil/Sorgeberechtigter", "Betreuer", "Bevollmächtigter", "Sonstiges"];
      required: true;
    };
  };
}
```

---

## 📋 Section 11: Metadata (SYSTEM)

**Purpose:** System-generated tracking data for audit, versioning, and workflow.

```typescript
interface Metadata {
  // Form Tracking
  form: {
    version: {
      type: "string";
      readOnly: true;
      autoFill: "1.0.0";
    };
    formId: {
      type: "string";
      readOnly: true;
      autoFill: "uuid";
    };
    locale: {
      type: "string";
      readOnly: true;
      autoFill: "de-DE";
    };
  };

  // Submission Tracking
  submission: {
    submittedAt: {
      type: "datetime";
      readOnly: true;
      autoFill: "now";
    };
    submittedBy: {
      type: "string";
      readOnly: true;
      // Patient ID or staff ID
    };
    channel: {
      type: "select";
      options: ["voice_ai", "web_form", "patient_portal", "staff_entry"];
      readOnly: true;
    };
  };

  // Data Source Tracking
  dataSource: {
    eGKRead: {
      type: "boolean";
      readOnly: true;
      default: false;
    };
    ePAImported: {
      type: "boolean";
      readOnly: true;
      default: false;
    };
    voiceTranscribed: {
      type: "boolean";
      readOnly: true;
      default: false;
    };
    paperScanned: {
      type: "boolean";
      readOnly: true;
      default: false;
    };
    verbalInput: {
      type: "boolean";
      readOnly: true;
      default: false;
    };
  };

  // AI Confidence Tracking
  aiConfidence: {
    overallScore: {
      type: "number";
      readOnly: true;
      min: 0;
      max: 100;
    };
    lowConfidenceFields: {
      type: "array";
      readOnly: true;
      // List of field paths with confidence < 80%
    };
    flaggedForReview: {
      type: "array";
      readOnly: true;
      // List of AI flag objects
    };
  };

  // Physician Review
  physicianReview: {
    status: {
      type: "select";
      options: ["pending", "reviewed", "verified", "needs_followup"];
      default: "pending";
    };
    reviewedBy: {
      type: "string";
      // Physician ID
    };
    reviewedAt: {
      type: "datetime";
    };
    reviewNotes: {
      type: "textarea";
      maxLength: 2000;
    };
  };

  // Follow-up Requirements
  followUp: {
    required: {
      type: "boolean";
      default: false;
    };
    type: {
      type: "multiselect";
      conditionalOn: { field: "required", values: [true] };
      options: [
        "lab_work",
        "imaging",
        "specialist_referral",
        "medication_review",
        "callback",
        "in_person_visit"
      ];
    };
    dueDate: {
      type: "date";
      conditionalOn: { field: "required", values: [true] };
    };
    notes: {
      type: "textarea";
      conditionalOn: { field: "required", values: [true] };
      maxLength: 1000;
    };
  };
}
```

---

## 🎨 UI Implementation Guidelines

### Field Types Reference

| Type | Component | Validation | Notes |
|------|-----------|------------|-------|
| `string` | `<Input>` | maxLength, pattern | Standard text input |
| `number` | `<Input type="number">` | min, max, step | Numeric input |
| `date` | `<DatePicker>` | minDate, maxDate | German format DD.MM.YYYY |
| `datetime` | `<DateTimePicker>` | - | Full datetime |
| `tel` | `<Input type="tel">` | pattern | Phone input |
| `email` | `<Input type="email">` | RFC 5322 | Email validation |
| `select` | `<Select>` | options | Single select dropdown |
| `multiselect` | `<MultiSelect>` | options, allowOther | Multi-select with chips |
| `textarea` | `<Textarea>` | maxLength | Long-form text |
| `boolean` | `<Checkbox>` | - | Yes/No toggle |
| `array` | `<FieldArray>` | minItems, maxItems | Repeating sections |
| `file` | `<FileUpload>` | accept, maxSizeMB | Document upload |
| `signature` | `<SignaturePad>` | - | Digital signature canvas |
| `range` | `<Slider>` | min, max, step, labels | Severity scales |

### UX Features to Implement

1. **Progressive Disclosure**
   - Show CRITICAL fields first
   - Reveal HIGH/MODERATE sections progressively
   - Use accordion/stepper pattern

2. **Conditional Fields**
   - Implement `conditionalOn` logic
   - Show/hide fields based on dependencies
   - Clear hidden field values

3. **AI Assistance Mode**
   - Voice input button for each field
   - Confidence indicators (green/yellow/red)
   - "AI Flagged" badge for uncertain fields

4. **Validation**
   - Real-time validation
   - German-specific patterns (PLZ, phone, dates)
   - Required field indicators (*)

5. **Accessibility**
   - WCAG 2.1 AA compliance
   - Screen reader support
   - Keyboard navigation

6. **Localization**
   - All labels in German
   - Date format: DD.MM.YYYY
   - Number format: 1.234,56

---

## 🚨 AI Flag Types

```typescript
type AIFlagType = 
  | "VERIFY_IDENTITY"      // Yellow - Confirm patient identity
  | "VERIFY_SYMPTOMS"      // Orange - Clarify symptoms with patient
  | "VERIFY_MEDICATION"    // Orange - Confirm current medications
  | "VERIFY_ALLERGY"       // Red - Confirm allergies
  | "LOW_CONFIDENCE"       // Gray - AI unsure about transcription
  | "PATIENT_EDITED"       // Blue - Patient modified this field in portal
  | "CRITICAL_VALUE"       // Red - Clinically significant finding
  | "INCOMPLETE_DATA";     // Yellow - Required data missing

interface AIFlag {
  type: AIFlagType;
  fieldPath: string;        // e.g., "medications[0].name"
  confidence: number;       // 0-100
  reason: string;           // Human-readable explanation
  suggestedValue?: string;  // AI's best guess
  createdAt: string;        // ISO timestamp
  resolvedAt?: string;      // When physician verified
  resolvedBy?: string;      // Physician ID
}
```

---

## ⚙️ Implementation Decisions

| Question | Decision | Notes |
|----------|----------|-------|
| **eGK/ePA Integration** | 🔜 TBD | Will clarify SDK/connector details later |
| **ICD-10 Autocomplete** | 🔜 TBD | Will clarify database/API later |
| **Medication Database** | 🔜 TBD | Will clarify PZN source later |
| **Digital Signature** | ✅ Drawn signature | Canvas-based signature is legally sufficient |
| **File Storage** | ✅ FHIR Binary | Store as FHIR Binary resources on Aidbox |
| **Multi-language** | ✅ Yes | Support multiple languages (German primary) |
| **Offline Support** | ✅ Yes | Keep data locally, sync when online |
| **Max File Size** | ✅ 20MB | Per-file upload limit |
| **Build Priority** | ✅ All sections | Agentic approach - build complete schema |
| **Voice Input Mode** | ✅ Full voice mode | Switch to complete voice-driven input |

---

## 🎙️ Voice Input Mode Specification

The form must support a **full voice input mode** where users can complete the entire intake via voice.

### Voice Mode Architecture

```typescript
interface VoiceInputConfig {
  enabled: boolean;
  mode: "field_by_field" | "conversational" | "hybrid";
  language: string;  // BCP-47 code (e.g., "de-DE")
  fallbackLanguage: string;  // e.g., "en-US"
  
  // 11 Labs integration
  elevenLabsAgentId: string;
  voiceId: string;
  
  // Transcription settings
  transcriptionProvider: "elevenlabs" | "whisper" | "google";
  confidenceThreshold: number;  // 0-1, below this flag for review
  
  // UX settings
  autoAdvance: boolean;  // Move to next field after confirmation
  confirmationRequired: boolean;  // Repeat back values for confirmation
  interruptible: boolean;  // User can interrupt AI mid-speech
}
```

### Voice Mode UI Components

```typescript
interface VoiceModeUI {
  // Global toggle
  voiceModeToggle: {
    position: "top-right";
    icon: "microphone";
    states: ["off", "listening", "processing", "speaking"];
  };
  
  // Per-field microphone button
  fieldMicButton: {
    position: "input-suffix";
    showWhen: "voiceMode === 'hybrid' || hover";
  };
  
  // Voice status indicator
  statusBar: {
    position: "bottom-fixed";
    showWhen: "voiceMode !== 'off'";
    displays: ["current_field", "transcription_preview", "confidence_score"];
  };
  
  // Waveform visualization
  waveform: {
    type: "frequency_bars" | "sine_wave";
    showWhen: "listening";
  };
}
```

### Voice Flow Per Section

```typescript
interface VoiceFlowConfig {
  section: string;
  prompts: {
    intro: string;      // "Let's start with your personal information..."
    fieldPrompt: string;  // "What is your first name?"
    confirmation: string; // "I heard [value]. Is that correct?"
    nextField: string;    // "Great. Now, what is your last name?"
    sectionComplete: string; // "Personal information complete. Moving to medical history."
  };
  skipConditions: string[];  // Fields to skip based on prior answers
  emergencyKeywords: string[];  // Trigger immediate triage escalation
}
```

### Example Voice Conversation Flow

```
AI: "Willkommen bei der Patientenanmeldung. Ich werde Ihnen einige 
     Fragen stellen, um Ihre Daten aufzunehmen. Wie ist Ihr Vorname?"

Patient: "Thomas"

AI: "Thomas. Und Ihr Nachname?"

Patient: "Müller"

AI: "Thomas Müller. Wann sind Sie geboren? Bitte nennen Sie 
     Tag, Monat und Jahr."

Patient: "Fünfzehnter März neunzehnhundertfünfundsiebzig"

AI: "Ich habe den 15. März 1975 notiert. Stimmt das?"

Patient: "Ja"

AI: "Perfekt. Was ist der Grund Ihres heutigen Besuchs?"

Patient: "Ich habe seit drei Tagen starke Kopfschmerzen..."
```

---

## 💾 Offline Storage Specification

The form must work offline with automatic sync when connectivity is restored.

### Offline Architecture

```typescript
interface OfflineConfig {
  storage: {
    type: "indexeddb";
    dbName: "ignis_patient_intake";
    maxStorageMB: 100;
    encryptionEnabled: true;
  };
  
  sync: {
    strategy: "queue_and_retry";
    retryIntervalMs: 30000;
    maxRetries: 10;
    conflictResolution: "server_wins" | "client_wins" | "manual";
  };
  
  caching: {
    staticAssets: true;
    autocompleteData: true;  // Cache ICD-10, medications locally
    formSchema: true;
  };
}
```

### Offline Data Model

```typescript
interface OfflineSubmission {
  id: string;  // UUID
  formData: PatientIntakeForm;
  status: "draft" | "pending_sync" | "syncing" | "synced" | "failed";
  createdAt: string;  // ISO timestamp
  updatedAt: string;
  lastSyncAttempt?: string;
  syncError?: string;
  retryCount: number;
}

interface OfflineQueue {
  submissions: OfflineSubmission[];
  fileUploads: OfflinePendingUpload[];
}

interface OfflinePendingUpload {
  id: string;
  submissionId: string;
  fieldPath: string;  // e.g., "diagnosticDocuments.labResults[0].upload"
  file: {
    name: string;
    type: string;
    size: number;
    localUri: string;  // IndexedDB blob reference
  };
  status: "pending" | "uploading" | "uploaded" | "failed";
}
```

### Offline UI Indicators

```typescript
interface OfflineUI {
  // Connection status banner
  connectionBanner: {
    position: "top-fixed";
    states: {
      online: { color: "green", text: "Online" };
      offline: { color: "amber", text: "Offline - Daten werden lokal gespeichert" };
      syncing: { color: "blue", text: "Synchronisiere..." };
    };
  };
  
  // Pending sync indicator
  syncBadge: {
    position: "header";
    showCount: true;  // "3 pending submissions"
  };
  
  // Auto-save indicator
  autoSaveIndicator: {
    position: "form-footer";
    interval: 5000;  // Auto-save every 5s
    states: ["saving", "saved", "error"];
  };
}
```

---

## 🌍 Multi-Language Support

The form must support multiple languages with German as primary.

### Language Configuration

```typescript
interface LocaleConfig {
  defaultLocale: "de-DE";
  supportedLocales: ["de-DE", "en-US", "tr-TR", "ar-SA", "ru-RU"];
  
  // RTL support for Arabic
  rtlLocales: ["ar-SA"];
  
  // Voice recognition language codes
  voiceLanguageMap: {
    "de-DE": "de-DE",
    "en-US": "en-US",
    "tr-TR": "tr-TR",
    "ar-SA": "ar-SA",
    "ru-RU": "ru-RU"
  };
  
  // Translation strategy
  translationSource: "i18next" | "custom";
  fallbackChain: ["de-DE"];  // If translation missing, fall back to German
}
```

### Translation Keys Structure

```typescript
interface TranslationKeys {
  // Section headers
  "sections.administrative": string;
  "sections.medicalHistory": string;
  "sections.currentSymptoms": string;
  // ...
  
  // Field labels
  "fields.firstName": string;
  "fields.lastName": string;
  "fields.dateOfBirth": string;
  // ...
  
  // Validation messages
  "validation.required": string;
  "validation.invalidEmail": string;
  "validation.invalidPostalCode": string;
  // ...
  
  // Select options (must translate all options)
  "options.gender.male": string;
  "options.gender.female": string;
  "options.gender.other": string;
  // ...
  
  // Voice prompts
  "voice.intro": string;
  "voice.askFirstName": string;
  "voice.confirmValue": string;
  // ...
  
  // UI elements
  "ui.submit": string;
  "ui.next": string;
  "ui.previous": string;
  "ui.save": string;
  // ...
}
```

### Language Selector UI

```typescript
interface LanguageSelector {
  position: "header-right";
  display: "dropdown" | "flags" | "text";
  showNativeNames: true;  // "Deutsch", "English", "Türkçe", "العربية", "Русский"
  persistSelection: true;  // Remember in localStorage
  affectsVoiceInput: true;  // Switch voice recognition language too
}
```

---

## 📁 FHIR Binary Storage

Files are stored as FHIR Binary resources on the Aidbox server.

### Upload Flow

```typescript
interface FileUploadConfig {
  maxSizeMB: 20;
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/dicom"  // Medical imaging
  ];
  
  // FHIR storage
  fhirEndpoint: "/fhir/Binary";
  
  // Processing
  compression: {
    images: true;
    maxDimension: 2048;
    quality: 0.85;
  };
  
  // Offline handling
  offlineStorage: "indexeddb";
  syncOnReconnect: true;
}

interface FHIRBinaryResource {
  resourceType: "Binary";
  id: string;
  contentType: string;
  data: string;  // Base64 encoded
  securityContext?: {
    reference: string;  // Reference to Patient
  };
}

interface DocumentReferenceLink {
  resourceType: "DocumentReference";
  status: "current";
  type: {
    coding: [{
      system: "http://loinc.org";
      code: string;
      display: string;
    }];
  };
  subject: {
    reference: string;  // Patient reference
  };
  content: [{
    attachment: {
      contentType: string;
      url: string;  // Reference to Binary resource
      title: string;
      creation: string;
    };
  }];
}
```

---

## 🔜 Pending Clarifications

The following items will be clarified later:

| Item | Status | Impact |
|------|--------|--------|
| eGK Reader SDK | 🔜 Pending | Affects insurance data import |
| ePA Connector (Gematik) | 🔜 Pending | Affects medical history import |
| ICD-10-GM Database/API | 🔜 Pending | Affects diagnosis autocomplete |
| PZN Medication Database | 🔜 Pending | Affects medication autocomplete |

### Placeholder Implementations

Until clarified, use these fallback approaches:

```typescript
// ICD-10 Autocomplete (placeholder)
interface ICD10Fallback {
  source: "static_json";  // Bundle top 500 common codes
  searchType: "fuzzy";
  allowFreeText: true;
  flagUncodedDiagnoses: true;  // AI flag for physician to code
}

// Medication Autocomplete (placeholder)
interface MedicationFallback {
  source: "static_json";  // Bundle top 1000 common medications
  searchFields: ["name", "activeIngredient"];
  allowFreeText: true;
  flagUnknownMedications: true;
}

// eGK/ePA (placeholder)
interface EHealthFallback {
  mode: "manual_entry";  // User types insurance info manually
  showImportButton: true;  // Greyed out "Import from eGK" button
  tooltip: "eGK-Import wird in Kürze verfügbar sein";
}
```

---

## 🔗 Related Documents

- [PLAN.md](../docs/PLAN.md) - Overall system architecture and implementation plan
- [Patient Flow Diagrams](../docs/PLAN.md#patient-call-flow-3-tier-triage) - Triage and intake flows
- [AI Flags Specification](../docs/PLAN.md#ai-flags-for-doctor-review) - Flag types and usage
