# Questionnaire & Multilingual Architecture

> Konzept für die Patientenaufnahme (Anamnese) mit Web-Frontend und Voice-Agent Integration

## Übersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FHIR Questionnaire                           │
│              (Struktur, Codes, enableWhen-Logik)                   │
│                    Sprache: Deutsch (Default)                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────────┐
│     Web-Frontend        │     │         Voice Agent                 │
│                         │     │        (ElevenLabs)                 │
│  • Feste i18n-Texte     │     │                                     │
│  • JSON im Code         │     │  • LLM interpretiert Questionnaire  │
│  • de/en/tr/...         │     │  • Generiert natürliche Fragen      │
│  • Kontrolliert         │     │  • Erkennt Synonyme dynamisch       │
│                         │     │  • Mappt auf FHIR-Codes             │
└─────────────────────────┘     └─────────────────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    QuestionnaireResponse                            │
│              (Einheitliche Antworten mit FHIR-Codes)               │
└─────────────────────────────────────────────────────────────────────┘
```

## Entscheidung: Übersetzungen im Frontend-Code

**Empfehlung:** Übersetzungen als JSON-Dateien im Frontend-Code (`src/locales/`)

### Begründe

| Option | Pro | Contra |
|--------|-----|--------|
| **Frontend-Code** ✅ | Versioniert, typsicher, Build-Zeit-Validierung, Offline-fähig, Standard-Pattern | Deployment für Textänderungen |
| FHIR Store | Dynamisch änderbar | Zusätzliche API-Calls, Komplexität, kein i18n-Standard |
| CMS/Backend | Nicht-Devs können ändern | Overhead, weiteres System |

**Für Hackathon/MVP:** Frontend-Code ist der pragmatische Weg.

### Struktur

```
frontend/
└── src/
    └── locales/
        ├── de.json          # Deutsch (Default)
        ├── en.json          # English
        ├── tr.json          # Türkisch
        └── index.ts         # Type-safe exports
```

### Beispiel Locale-Datei

```json
// src/locales/de.json
{
  "questionnaire": {
    "title": "Patientenaufnahme - Anamnese",
    "sections": {
      "personal": "Persönliche Angaben",
      "symptoms": "Aktuelle Beschwerden",
      "medicalHistory": "Vorerkrankungen",
      "medications": "Aktuelle Medikation",
      "allergies": "Allergien und Unverträglichkeiten",
      "lifestyle": "Lebensstil",
      "familyHistory": "Familiengeschichte",
      "women": "Fragen für Frauen",
      "emergency": "Notfallkontakt",
      "consent": "Einwilligung"
    },
    "questions": {
      "visit-reason": {
        "label": "Was ist der Hauptgrund für Ihren heutigen Besuch?",
        "options": {
          "acute": "Akute Beschwerden",
          "checkup": "Vorsorgeuntersuchung",
          "followup": "Nachuntersuchung",
          "prescription": "Rezept/Überweisung",
          "other": "Sonstiges"
        }
      },
      "symptom-location": {
        "label": "Wo haben Sie Beschwerden?",
        "options": {
          "head": "Kopf",
          "chest": "Brust/Brustkorb",
          "abdomen": "Bauch",
          "back": "Rücken",
          "extremities": "Arme/Beine",
          "throat": "Hals/Rachen",
          "skin": "Haut",
          "general": "Allgemein/Ganzer Körper"
        }
      }
      // ... weitere Fragen
    },
    "buttons": {
      "next": "Weiter",
      "back": "Zurück",
      "submit": "Absenden",
      "loading": "Wird gesendet..."
    },
    "validation": {
      "required": "Dieses Feld ist erforderlich",
      "invalidPhone": "Ungültige Telefonnummer"
    }
  }
}
```

## FHIR Questionnaire Design

Das Questionnaire enthält:
- **Struktur:** `linkId`, `type`, `required`, `repeats`
- **Logik:** `enableWhen`, `enableBehavior`
- **Codes:** `answerOption` mit `valueCoding.code`
- **Display-Texte:** Deutsch als Default (Fallback)

**Wichtig:** Die `code`-Werte sind sprachunabhängig und werden in der QuestionnaireResponse gespeichert.

```json
{
  "linkId": "smoking-status",
  "text": "Rauchen Sie?",           // Fallback, nicht primär genutzt
  "type": "choice",
  "answerOption": [
    {"valueCoding": {"code": "never", "display": "Nie geraucht"}},
    {"valueCoding": {"code": "former", "display": "Früher geraucht"}},
    {"valueCoding": {"code": "current", "display": "Ja, aktuell"}},
    {"valueCoding": {"code": "occasional", "display": "Gelegentlich"}}
  ]
}
```

## Voice Agent Integration

### Konzept

Der Voice Agent (ElevenLabs + LLM) bekommt:
1. Die Questionnaire-Struktur aus FHIR
2. Einen System-Prompt mit Anweisungen
3. Die Zielsprache des Anrufers

Der LLM generiert dann natürliche Fragen und mappt Antworten auf Codes.

### System-Prompt Template

```markdown
Du bist ein freundlicher medizinischer Assistent für die Patientenaufnahme.

## Questionnaire-Struktur
{questionnaire_json}

## Deine Aufgabe
1. Stelle die Fragen in natürlicher Sprache ({language})
2. Bei Multiple-Choice: Nenne die Optionen wenn nötig
3. Erkenne Synonyme und umgangssprachliche Antworten
4. Mappe Antworten auf die FHIR-Codes
5. Beachte enableWhen-Bedingungen

## Beispiel-Mappings
- "Mir geht es nicht gut" → visit-reason: "acute"
- "Zucker" → chronic-conditions: "diabetes"
- "stark" (bei Schmerzskala) → symptom-severity: 7

## Bei Unklarheiten
Frage nach oder biete die Optionen an:
"Entschuldigung, ich habe Sie nicht ganz verstanden.
Meinen Sie [Option A], [Option B], oder [Option C]?"
```

### Antwort-Format (an Backend)

```json
{
  "questionnaireResponse": {
    "resourceType": "QuestionnaireResponse",
    "questionnaire": "Questionnaire/patient-intake-de",
    "status": "completed",
    "item": [
      {
        "linkId": "visit-reason",
        "answer": [{"valueCoding": {"code": "acute"}}]
      },
      {
        "linkId": "symptom-location",
        "answer": [
          {"valueCoding": {"code": "head"}},
          {"valueCoding": {"code": "chest"}}
        ]
      }
    ]
  }
}
```

## Frontend Implementation

### Empfohlene Libraries

Für das bestehende React/Vite Setup:

```bash
# Leichtgewichtig, kein Framework-Lock-in
bun add i18next react-i18next
```

### Verwendung

```tsx
// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';

i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: 'de',
  fallbackLng: 'de',
});

export default i18n;

// In Komponente
import { useTranslation } from 'react-i18next';

function QuestionnaireForm() {
  const { t } = useTranslation();

  return (
    <Label>{t('questionnaire.questions.visit-reason.label')}</Label>
  );
}
```

### Questionnaire-Renderer

```tsx
// Dynamisch aus FHIR + i18n
function QuestionnaireItem({ item, locale }) {
  const { t } = useTranslation();
  const translationKey = `questionnaire.questions.${item.linkId}`;

  // Versuche Übersetzung, Fallback auf FHIR text
  const label = t(`${translationKey}.label`, { defaultValue: item.text });

  if (item.type === 'choice') {
    return (
      <RadioGroup>
        {item.answerOption.map(opt => (
          <RadioItem
            key={opt.valueCoding.code}
            value={opt.valueCoding.code}
            label={t(`${translationKey}.options.${opt.valueCoding.code}`, {
              defaultValue: opt.valueCoding.display
            })}
          />
        ))}
      </RadioGroup>
    );
  }
  // ... andere Typen
}
```

## Offene Punkte / Nächste Schritte

- [ ] i18next Setup im Frontend
- [ ] Locale-Dateien erstellen (de, en, tr)
- [ ] Questionnaire-Renderer Komponente
- [ ] Voice-Agent System-Prompt finalisieren
- [ ] QuestionnaireResponse API-Endpoint
- [ ] enableWhen-Logik im Frontend implementieren

## Ressourcen

- FHIR Questionnaire: `https://ignis.cognovis.de/fhir/Questionnaire/patient-intake-de`
- [FHIR Questionnaire Spec](http://hl7.org/fhir/questionnaire.html)
- [i18next Docs](https://www.i18next.com/)
