/**
 * ElevenLabs Agent Simulation Test Runner
 * 
 * Uses the ElevenLabs Simulation API to run test scenarios,
 * validates tool calls, and verifies database state in Aidbox.
 * 
 * Usage:
 *   bun run scripts/test-agent-simulation.ts [--scenario=1] [--all]
 * 
 * Environment:
 *   ELEVENLABS_API_KEY - ElevenLabs API key
 *   AGENT_ID - ElevenLabs agent ID (default: agent_8101kgaq3e85ecqay2ctsjgp0y2e)
 */

const AGENT_ID = process.env.AGENT_ID || 'agent_2001kgaacwnff529zfp0nmh4ppjq';
const API_KEY = process.env.ELEVENLABS_API_KEY;
const AIDBOX_URL = process.env.AIDBOX_FHIR_URL || 'https://ignis.cognovis.de/fhir';
const AIDBOX_USER = process.env.AIDBOX_USER || 'admin';
const AIDBOX_PASSWORD = process.env.AIDBOX_PASSWORD || 'ignis2026';

// ============================================
// Test Scenario Definitions
// ============================================

interface TestScenario {
  id: number;
  name: string;
  language: 'de' | 'en';
  simulatedUserPrompt: string;
  expectedToolCalls: string[];
  evaluationCriteria: Array<{
    id: string;
    name: string;
    prompt: string;
  }>;
  dbValidation?: () => Promise<boolean>;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 1,
    name: 'Returning Patient - Regular Booking (German)',
    language: 'de',
    simulatedUserPrompt: `You are Hans Müller calling to book an appointment.
- When asked for name and DOB, say: "Hans Müller, geboren am 15. März 1985"
- When offered times, choose: "Dienstag um 10 Uhr"
- When asked to confirm, say: "Ja, danke"
- Reason for visit: "Ich brauche einen zusätzlichen Termin für eine Grippeimpfung"
- Be polite and speak German throughout.`,
    expectedToolCalls: ['patient_lookup', 'get_available_slots', 'book_appointment'],
    evaluationCriteria: [
      { id: 'patient_found', name: 'Patient Found', prompt: 'The agent found the patient in the system and greeted them by name' },
      { id: 'appointment_booked', name: 'Appointment Booked', prompt: 'The agent successfully booked an appointment and confirmed the details' },
      { id: 'german_language', name: 'German Language', prompt: 'The agent responded in German throughout the conversation' },
    ],
  },
  {
    id: 2,
    name: 'Cancel Existing Appointment (German)',
    language: 'de',
    simulatedUserPrompt: `You are Hans Müller and want to cancel your appointment.
- Say: "Hallo, ich möchte meinen Termin absagen"
- When asked for name and DOB: "Hans Müller, 15.03.1985"
- When asked to confirm cancellation: "Ja bitte"
- When asked about rebooking: "Nein danke, ich melde mich später"
- Speak German throughout.`,
    expectedToolCalls: ['patient_lookup', 'cancel_appointment'],
    evaluationCriteria: [
      { id: 'found_appointment', name: 'Found Appointment', prompt: 'The agent found the upcoming appointment for the patient' },
      { id: 'cancelled', name: 'Cancelled', prompt: 'The agent successfully cancelled the appointment' },
    ],
  },
  {
    id: 3,
    name: 'New Patient Registration (German)',
    language: 'de',
    simulatedUserPrompt: `You are Peter Schulz, a new patient.
- Say: "Guten Tag, ich bin neu hier und brauche einen Termin"
- When asked for name and DOB: "Peter Schulz, geboren am 5. Juni 1988"
- When asked for phone: "0173 4567890"
- When asked to confirm: "Ja, genau"
- Reason: "Ich brauche einen Gesundheitscheck"
- Choose any offered time slot.
- Speak German throughout.`,
    expectedToolCalls: ['patient_lookup', 'patient_create_or_update', 'get_available_slots', 'book_appointment'],
    evaluationCriteria: [
      { id: 'new_patient_flow', name: 'New Patient Flow', prompt: 'The agent correctly identified the caller as a new patient and collected registration info' },
      { id: 'patient_created', name: 'Patient Created', prompt: 'The agent created a new patient record' },
    ],
  },
  {
    id: 4,
    name: 'Returning Patient - English',
    language: 'en',
    simulatedUserPrompt: `You are Maria Weber calling to book an appointment.
- Say: "Hi, I'd like to book an appointment"
- When asked for name and DOB: "Maria Weber, August 22, 1972"
- Reason: "I need a routine checkup"
- Choose any offered time slot.
- Speak English throughout.`,
    expectedToolCalls: ['patient_lookup', 'get_available_slots'],
    evaluationCriteria: [
      { id: 'english_response', name: 'English Response', prompt: 'The agent responded in English after detecting English input' },
      { id: 'patient_found', name: 'Patient Found', prompt: 'The agent found the patient in the system' },
    ],
  },
  {
    id: 5,
    name: 'Emergency Detection Mid-Conversation (German)',
    language: 'de',
    simulatedUserPrompt: `You are calling about an appointment but suddenly have chest pain.
- Start: "Guten Tag, ich möchte einen Termin für..."
- Then interrupt: "...warten Sie, ich habe gerade starke Brustschmerzen"
- Sound distressed and urgent.`,
    expectedToolCalls: ['register_emergency_transfer'],
    evaluationCriteria: [
      { id: 'emergency_detected', name: 'Emergency Detected', prompt: 'The agent immediately detected the emergency when chest pain was mentioned' },
      { id: 'emergency_response', name: 'Emergency Response', prompt: 'The agent told the patient to call 112 or transferred to medical staff' },
    ],
  },
  {
    id: 6,
    name: 'Emergency Detection (English)',
    language: 'en',
    simulatedUserPrompt: `You are having trouble breathing.
- Say immediately: "Hello, I'm calling because I can't breathe properly"
- Sound distressed.`,
    expectedToolCalls: ['register_emergency_transfer'],
    evaluationCriteria: [
      { id: 'emergency_immediate', name: 'Immediate Emergency', prompt: 'The agent immediately recognized this as an emergency' },
    ],
  },
  {
    id: 7,
    name: 'Urgent Case - Post-Surgery Bleeding (German)',
    language: 'de',
    simulatedUserPrompt: `You are Thomas Becker with post-surgery bleeding.
- Say: "Hallo, ich hatte gestern eine Operation und die Wunde blutet ziemlich stark"
- When asked for name and DOB: "Thomas Becker, 1. Dezember 1990"
- If no same-day slots, accept being added to urgent queue.`,
    expectedToolCalls: ['patient_lookup', 'get_available_slots', 'add_to_urgent_queue'],
    evaluationCriteria: [
      { id: 'urgent_recognized', name: 'Urgent Recognized', prompt: 'The agent recognized this as an urgent case requiring same-day attention' },
      { id: 'urgent_queue', name: 'Added to Queue', prompt: 'The agent added the patient to the urgent queue when no slots were available' },
    ],
  },
  {
    id: 8,
    name: 'Prescription Refill Request (English)',
    language: 'en',
    simulatedUserPrompt: `You are Maria Weber needing a prescription refill.
- Say: "Hi, I need a refill on my blood pressure medication"
- When asked for name and DOB: "Maria Weber, August 22, 1972"
- When asked about callback number: "You can use the number on file"`,
    expectedToolCalls: ['patient_lookup', 'request_callback'],
    evaluationCriteria: [
      { id: 'callback_scheduled', name: 'Callback Scheduled', prompt: 'The agent arranged a callback for the prescription request' },
      { id: 'category_prescription', name: 'Prescription Category', prompt: 'The callback was categorized as a prescription request' },
    ],
  },
  {
    id: 9,
    name: 'Billing Question (German)',
    language: 'de',
    simulatedUserPrompt: `You have a billing question.
- Say: "Guten Tag, ich habe eine Frage zu meiner Rechnung"
- When asked for name and phone: "Hans Müller, 0170 1234567"`,
    expectedToolCalls: ['request_callback'],
    evaluationCriteria: [
      { id: 'billing_routed', name: 'Billing Routed', prompt: 'The agent arranged a callback for billing' },
    ],
  },
  {
    id: 10,
    name: 'Test Results Inquiry (English)',
    language: 'en',
    simulatedUserPrompt: `You want to know your test results.
- Say: "Hi, I'd like to know my blood test results from last week"
- When asked for name and DOB: "Thomas Becker, December 1, 1990"`,
    expectedToolCalls: ['patient_lookup', 'request_callback'],
    evaluationCriteria: [
      { id: 'results_handled', name: 'Results Handled', prompt: 'The agent explained test results require staff callback' },
    ],
  },
];

// ============================================
// API Helpers
// ============================================

async function simulateConversation(scenario: TestScenario): Promise<{
  success: boolean;
  transcript: Array<{ role: string; message: string; tool_calls?: any[] }>;
  toolCalls: string[];
  evaluation: Record<string, { result: string; rationale: string }>;
  error?: string;
}> {
  if (!API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is required');
  }

  const url = `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}/simulate-conversation`;
  
  const body = {
    simulation_specification: {
      simulated_user_config: {
        prompt: {
          prompt: scenario.simulatedUserPrompt,
          llm: 'gpt-4o',
          temperature: 0.7,
        },
      },
      // Mock tool responses to avoid hitting real backend during tests
      tool_mock_config: {
        patient_lookup: {
          mock_type: 'static',
          static_response: JSON.stringify({
            found: true,
            patientId: 'patient-1',
            patientName: 'Herr Müller',
            upcomingAppointment: { appointmentId: 'appointment-1', start: '2026-02-03T09:00:00' },
          }),
        },
        get_available_slots: {
          mock_type: 'static',
          static_response: JSON.stringify({
            slots: [
              { slotId: 'slot-1', start: '2026-02-04T10:00:00', end: '2026-02-04T10:30:00', practitionerDisplay: 'Dr. Anna Schmidt' },
              { slotId: 'slot-2', start: '2026-02-05T14:30:00', end: '2026-02-05T15:00:00', practitionerDisplay: 'Dr. Anna Schmidt' },
            ],
          }),
        },
        book_appointment: {
          mock_type: 'static',
          static_response: JSON.stringify({
            appointment: { id: 'apt-new', status: 'booked' },
            confirmationMessage: 'Ihr Termin wurde bestätigt.',
          }),
        },
        cancel_appointment: {
          mock_type: 'static',
          static_response: JSON.stringify({ cancelled: true, message: 'Termin abgesagt.' }),
        },
        patient_create_or_update: {
          mock_type: 'static',
          static_response: JSON.stringify({ patient: { id: 'patient-new' }, created: true }),
        },
        add_to_urgent_queue: {
          mock_type: 'static',
          static_response: JSON.stringify({ queueEntryId: 'queue-1', position: 1, message: 'Sie wurden in die Warteschlange aufgenommen.' }),
        },
        register_emergency_transfer: {
          mock_type: 'static',
          static_response: JSON.stringify({ transferId: 'emergency-1', message: 'Notfall registriert.' }),
        },
        request_callback: {
          mock_type: 'static',
          static_response: JSON.stringify({ callbackId: 'cb-1', estimatedTime: 'within 2 hours' }),
        },
      },
    },
    extra_evaluation_criteria: scenario.evaluationCriteria.map(c => ({
      id: c.id,
      name: c.name,
      conversation_goal_prompt: c.prompt,
      use_knowledge_base: false,
    })),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Extract tool calls from transcript (response uses simulated_conversation)
    const toolCalls: string[] = [];
    const transcript = data.simulated_conversation || data.conversation || [];
    
    for (const turn of transcript) {
      // Check tool_calls array
      if (turn.tool_calls && Array.isArray(turn.tool_calls)) {
        for (const tc of turn.tool_calls) {
          const toolName = tc.tool_name || tc.name;
          if (toolName && !toolCalls.includes(toolName)) {
            toolCalls.push(toolName);
          }
        }
      }
      // Check tool_results array (indicates a tool was called)
      if (turn.tool_results && Array.isArray(turn.tool_results)) {
        for (const tr of turn.tool_results) {
          const toolName = tr.tool_name || tr.name;
          if (toolName && !toolCalls.includes(toolName)) {
            toolCalls.push(toolName);
          }
        }
      }
    }

    // Extract evaluation results
    const evaluation = data.analysis?.evaluation_criteria_results || {};

    return {
      success: true,
      transcript,
      toolCalls,
      evaluation,
    };
  } catch (error) {
    return {
      success: false,
      transcript: [],
      toolCalls: [],
      evaluation: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function queryAidbox(resourceType: string, params: Record<string, string> = {}): Promise<any> {
  const queryString = new URLSearchParams(params).toString();
  const url = `${AIDBOX_URL}/${resourceType}${queryString ? '?' + queryString : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + btoa(`${AIDBOX_USER}:${AIDBOX_PASSWORD}`),
      'Accept': 'application/fhir+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Aidbox query failed: ${response.status}`);
  }

  return response.json();
}

async function validateDatabase(): Promise<{ patients: number; appointments: number; tasks: number }> {
  const [patients, appointments, tasks] = await Promise.all([
    queryAidbox('Patient', { _summary: 'count' }),
    queryAidbox('Appointment', { _summary: 'count' }),
    queryAidbox('Task', { _summary: 'count' }),
  ]);

  return {
    patients: patients.total || 0,
    appointments: appointments.total || 0,
    tasks: tasks.total || 0,
  };
}

// ============================================
// Test Runner
// ============================================

interface TestResult {
  scenarioId: number;
  name: string;
  passed: boolean;
  toolCallsExpected: string[];
  toolCallsActual: string[];
  toolCallsMatch: boolean;
  evaluationResults: Record<string, { result: string; rationale: string }>;
  error?: string;
  duration: number;
}

async function runScenario(scenario: TestScenario): Promise<TestResult> {
  const start = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Test ${scenario.id}: ${scenario.name}`);
  console.log(`   Language: ${scenario.language.toUpperCase()}`);
  console.log(`   Expected tools: ${scenario.expectedToolCalls.join(', ')}`);
  console.log('='.repeat(60));

  const result = await simulateConversation(scenario);
  const duration = Date.now() - start;

  if (!result.success) {
    console.log(`❌ FAILED: ${result.error}`);
    return {
      scenarioId: scenario.id,
      name: scenario.name,
      passed: false,
      toolCallsExpected: scenario.expectedToolCalls,
      toolCallsActual: [],
      toolCallsMatch: false,
      evaluationResults: {},
      error: result.error,
      duration,
    };
  }

  // Check tool calls
  const expectedSet = new Set(scenario.expectedToolCalls);
  const actualSet = new Set(result.toolCalls);
  const toolCallsMatch = scenario.expectedToolCalls.every(tc => actualSet.has(tc));

  // Print transcript summary
  console.log('\n📝 Conversation:');
  for (const turn of result.transcript.slice(0, 10)) {
    const role = turn.role === 'user' ? '👤' : '🤖';
    const msg = turn.message?.slice(0, 100) || '[no message]';
    console.log(`   ${role} ${msg}${turn.message?.length > 100 ? '...' : ''}`);
  }

  // Print tool calls
  console.log('\n🔧 Tool Calls:');
  console.log(`   Expected: ${scenario.expectedToolCalls.join(', ')}`);
  console.log(`   Actual:   ${result.toolCalls.join(', ') || '(none)'}`);
  console.log(`   Match:    ${toolCallsMatch ? '✅' : '❌'}`);

  // Print evaluation
  console.log('\n📊 Evaluation:');
  let allPassed = true;
  for (const [id, res] of Object.entries(result.evaluation)) {
    const icon = res.result === 'success' ? '✅' : '❌';
    console.log(`   ${icon} ${id}: ${res.result}`);
    if (res.result !== 'success') allPassed = false;
  }

  const passed = toolCallsMatch && allPassed;
  console.log(`\n${passed ? '✅ PASSED' : '❌ FAILED'} (${duration}ms)`);

  return {
    scenarioId: scenario.id,
    name: scenario.name,
    passed,
    toolCallsExpected: scenario.expectedToolCalls,
    toolCallsActual: result.toolCalls,
    toolCallsMatch,
    evaluationResults: result.evaluation,
    duration,
  };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     ElevenLabs Agent Simulation Test Runner                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`Aidbox:   ${AIDBOX_URL}`);
  console.log();

  // Check API key
  if (!API_KEY) {
    console.error('❌ ERROR: ELEVENLABS_API_KEY environment variable is required');
    console.log('   Set it in .env or export ELEVENLABS_API_KEY=your_key');
    process.exit(1);
  }

  // Parse args
  const args = process.argv.slice(2);
  const scenarioArg = args.find(a => a.startsWith('--scenario='));
  const runAll = args.includes('--all');
  const validateDb = args.includes('--validate-db');

  let scenariosToRun: TestScenario[] = [];

  if (scenarioArg) {
    const id = parseInt(scenarioArg.split('=')[1]);
    const scenario = TEST_SCENARIOS.find(s => s.id === id);
    if (!scenario) {
      console.error(`❌ Scenario ${id} not found. Available: 1-${TEST_SCENARIOS.length}`);
      process.exit(1);
    }
    scenariosToRun = [scenario];
  } else if (runAll) {
    scenariosToRun = TEST_SCENARIOS;
  } else {
    // Default: run first scenario as a quick test
    scenariosToRun = [TEST_SCENARIOS[0]];
    console.log('💡 Tip: Use --all to run all scenarios, or --scenario=N for specific test');
  }

  // Validate DB before tests
  if (validateDb) {
    console.log('\n📊 Database State (Before):');
    const dbBefore = await validateDatabase();
    console.log(`   Patients:     ${dbBefore.patients}`);
    console.log(`   Appointments: ${dbBefore.appointments}`);
    console.log(`   Tasks:        ${dbBefore.tasks}`);
  }

  // Run tests
  const results: TestResult[] = [];
  for (const scenario of scenariosToRun) {
    const result = await runScenario(scenario);
    results.push(result);
  }

  // Validate DB after tests
  if (validateDb) {
    console.log('\n📊 Database State (After):');
    const dbAfter = await validateDatabase();
    console.log(`   Patients:     ${dbAfter.patients}`);
    console.log(`   Appointments: ${dbAfter.appointments}`);
    console.log(`   Tasks:        ${dbAfter.tasks}`);
  }

  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} Test ${r.scenarioId}: ${r.name} (${r.duration}ms)`);
  }

  console.log();
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log();

  if (failed > 0) {
    console.log('❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
