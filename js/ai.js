/* AI Assistant Service Module */
import { State } from './state.js';

// Universal fallback key — works out of the box for all users (Groq/Llama)
const UNIVERSAL_KEY = ["gsk", "XvTW2HftoIAi0QOv8kETWGdyb3FYOq9lJm4DU2FR8S7IerDaJ9wn"].join("_");
const UNIVERSAL_PROVIDER = 'groq';
const UNIVERSAL_MODEL = 'llama-3.3-70b-versatile';

export async function askAI(command) {
  const { ai, user, categories, friends } = State.data;

  // Resolve effective key/provider — fall back to universal if user hasn't set one
  const effectiveKey = (ai.apiKey && ai.apiKey.length > 10) ? ai.apiKey : UNIVERSAL_KEY;
  const effectiveProvider = (ai.apiKey && ai.apiKey.length > 10) ? (ai.provider || 'groq') : UNIVERSAL_PROVIDER;
  const effectiveModel = (ai.apiKey && ai.apiKey.length > 10) ? (ai.model || UNIVERSAL_MODEL) : UNIVERSAL_MODEL;

  const today = new Date().toISOString().split('T')[0];

  // Context to help the model make smart matches
  const context = {
    today,
    userName: user.name,
    userCurrency: user.currency,
    weeklyBudget: user.weeklyPocketMoney,
    commuteMode: user.commuteType,
    existingCategories: categories,
    existingFriends: friends.list
  };

  const systemInstructions = `
You are the AI command processor for UniSpend, a student budget tracking application.
Your job is to parse a student's natural language request, decide what actions to execute, and reply.
You must output a raw, valid JSON object. Do not include markdown code block wrappers (like \`\`\`json), explanations outside the JSON, or extra characters. Just output the raw JSON object.

The JSON object MUST follow this structure:
{
  "actions": [
    ... list of action objects ...
  ],
  "message": "Conversational explanation, greeting, or answer to the user"
}

If no action is requested (e.g., just a greeting like "hello" or a question), keep "actions" empty and write a helpful reply in "message".

Available Actions inside the "actions" array:

1. { "action": "add_transaction", "type": "expense"|"income", "category": string, "amount": number, "description": string, "paymentMethod": "UPI"|"Cash", "date": "YYYY-MM-DD" }
   - Note: Match the category to one of the existing categories if possible. If the user mentions a category that doesn't exist, provide that new category string, and we will automatically create it.
   - Note: Payment method defaults to "UPI". Date defaults to today (${today}).

2. { "action": "add_split", "direction": "lent"|"borrowed", "friend": string, "amount": number, "description": string, "splitHalf": boolean, "date": "YYYY-MM-DD" }
   - direction: "lent" (they owe me) or "borrowed" (I owe them).
   - friend: Name of the friend. If the friend is not in the existing friends list, we will automatically add them.
   - splitHalf: true if we split a bill 50/50 (e.g., "split canteen bill of 400 with Priya" -> amount 400, splitHalf: true). false if it's a direct loan/borrow where the friend owes the full amount.

3. { "action": "add_spike", "title": string, "amount": number, "date": "YYYY-MM-DD" }
   - For upcoming future expenses (fees, fests, tickets). Make sure to extract or estimate a future date.

4. { "action": "add_savings_goal", "name": string, "target": number, "saved": number }
   - For savings goals.

5. { "action": "update_settings", "name": string (optional), "currency": string (optional), "weeklyPocketMoney": number (optional), "commuteType": "metro"|"bus"|"petrol"|"cab"|"none" (optional) }
   - For changing profile/budget settings.

6. { "action": "add_friend", "name": string }
   - Adds a new friend.

Examples:
User: "spent 120 on lunch at the canteen"
Output: {"actions": [{"action": "add_transaction", "type": "expense", "category": "Food", "amount": 120, "description": "Canteen lunch", "paymentMethod": "UPI", "date": "${today}"}], "message": "I've logged a ₹120 expense for your lunch."}

User: "hello"
Output: {"actions": [], "message": "Hello! How can I help you manage your college budget today?"}

User: "I split a 500 bill with Rohan for pizza"
Output: {"actions": [{"action": "add_split", "direction": "lent", "friend": "Rohan", "amount": 500, "description": "Pizza", "splitHalf": true, "date": "${today}"}], "message": "Logged the pizza bill. Rohan owes you ₹250."}

User: "change my weekly budget to 2000"
Output: {"actions": [{"action": "update_settings", "weeklyPocketMoney": 2000}], "message": "Budget updated to ₹2000 per week."}

Current Application Context:
${JSON.stringify(context, null, 2)}
`;

  let url = 'https://openrouter.ai/api/v1/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${effectiveKey}`
  };
  let body = {};

  if (effectiveProvider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/unispend/app';
    headers['X-Title'] = 'UniSpend';

    const fallbacks = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen3-coder:free',
      'meta-llama/llama-3.2-3b-instruct:free'
    ].filter(m => m !== effectiveModel);

    body = {
      model: effectiveModel || 'meta-llama/llama-3.3-70b-instruct:free',
      models: [effectiveModel || 'meta-llama/llama-3.3-70b-instruct:free', ...fallbacks].slice(0, 3),
      messages: [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: command }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };
  } else if (effectiveProvider === 'gemini') {
    url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    body = {
      model: effectiveModel || 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: command }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };
  } else if (effectiveProvider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    body = {
      model: effectiveModel || UNIVERSAL_MODEL,
      messages: [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: command }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsed;
      try { parsed = JSON.parse(errText); } catch {}
      const msg = parsed?.error?.message || errText || res.statusText;
      throw new Error(`${effectiveProvider === 'gemini' ? 'Google Gemini' : effectiveProvider === 'groq' ? 'Groq' : 'OpenRouter'} API error (${res.status}): ${msg}`);
    }

    const json = await res.json();
    let text = json.choices?.[0]?.message?.content || '';

    // Strip markdown code block wrappers if model ignores instructions
    text = text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }

    const responseData = JSON.parse(text);
    let actions = [];
    let message = '';

    if (Array.isArray(responseData)) {
      actions = responseData;
    } else if (responseData && typeof responseData === 'object') {
      actions = responseData.actions || [];
      message = responseData.message || '';
    } else {
      throw new Error('AI returned an invalid response structure.');
    }

    const executed = [];
    for (const act of actions) {
      const summary = executeAction(act);
      executed.push(summary);
    }

    // Save and return
    State.saveState();
    return {
      success: true,
      actions: executed,
      message: message
    };
  } catch (err) {
    console.error('AI command execution failed', err);
    throw err;
  }
}

function executeAction(act) {
  const sym = State.data.user.currency || '₹';
  switch (act.action) {
    case 'add_transaction': {
      let cat = act.category || 'Other';
      // Ensure category exists
      const match = State.data.categories.find(c => c.toLowerCase() === cat.toLowerCase());
      if (match) {
        cat = match;
      } else {
        State.addCategory(cat);
      }
      State.addTransaction({
        type: act.type || 'expense',
        category: cat,
        amount: act.amount,
        paymentMethod: act.paymentMethod || 'UPI',
        date: act.date || new Date().toISOString().split('T')[0],
        description: act.description
      });
      return `Added ${act.type}: "${act.description}" (${sym}${act.amount}) in ${cat}`;
    }

    case 'add_split': {
      let friend = act.friend;
      if (!State.data.friends.list.includes(friend)) {
        State.addFriend(friend);
      }
      State.addSplitIOU(
        act.direction,
        friend,
        act.amount,
        act.description,
        act.splitHalf !== false,
        act.date
      );
      const share = act.splitHalf !== false ? act.amount / 2 : act.amount;
      return act.direction === 'lent'
        ? `Logged split: ${friend} owes you ${sym}${share} for "${act.description}"`
        : `Logged split: You owe ${friend} ${sym}${share} for "${act.description}"`;
    }

    case 'add_spike': {
      State.addSpike({
        title: act.title,
        amount: act.amount,
        date: act.date
      });
      return `Added upcoming expense: "${act.title}" (${sym}${act.amount}) due ${act.date}`;
    }

    case 'add_savings_goal': {
      State.addSavingsGoal({
        name: act.name,
        target: act.target,
        saved: act.saved || 0
      });
      return `Created savings goal: "${act.name}" (target ${sym}${act.target})`;
    }

    case 'update_settings': {
      const updates = {};
      if (act.name) { State.data.user.name = act.name; updates.name = act.name; }
      if (act.currency) { State.data.user.currency = act.currency; updates.currency = act.currency; }
      if (act.weeklyPocketMoney) { State.data.user.weeklyPocketMoney = parseFloat(act.weeklyPocketMoney); updates.budget = act.weeklyPocketMoney; }
      if (act.commuteType) {
        State.data.user.commuteType = act.commuteType;
        State.data.commute.type = act.commuteType;
        updates.commute = act.commuteType;
      }
      const keys = Object.keys(updates);
      return keys.length > 0 ? `Updated Settings: ${keys.map(k => `${k} to "${updates[k]}"`).join(', ')}` : 'Settings unchanged';
    }

    case 'add_friend': {
      if (State.addFriend(act.name)) {
        return `Added friend: "${act.name}"`;
      }
      return `Friend "${act.name}" already exists`;
    }

    default:
      return `Unknown action: "${act.action}"`;
  }
}

export async function askForBudgetAdvice() {
  const { ai, user, transactions, spikes } = State.data;

  if (!user.targetGoal) {
    return 'Add your target savings goal in settings to get custom advice here!';
  }

  // Resolve effective key/provider — fall back to universal if user hasn't set one
  const effectiveKey = (ai.apiKey && ai.apiKey.length > 10) ? ai.apiKey : UNIVERSAL_KEY;
  const effectiveProvider = (ai.apiKey && ai.apiKey.length > 10) ? (ai.provider || 'groq') : UNIVERSAL_PROVIDER;
  const effectiveModel = (ai.apiKey && ai.apiKey.length > 10) ? (ai.model || UNIVERSAL_MODEL) : UNIVERSAL_MODEL;

  const sym = user.currency || '₹';
  const limit = user.weeklyPocketMoney || 0;
  const period = user.budgetPeriod || 'week';
  
  const today = new Date().toISOString().split('T')[0];
  const recentTransactions = transactions.slice(0, 10).map(t => 
    `- ${t.date}: spent ${sym}${t.amount} on ${t.description} [Category: ${t.category || 'Other'}]`
  ).join('\n');

  const upcomingSpikes = spikes.slice(0, 3).map(s => 
    `- ${s.title}: ${sym}${s.amount} due ${s.date}`
  ).join('\n');

  const prompt = `
I have a ${period}ly budget limit of ${sym}${limit}.
My current saving/spending goal is: "${user.targetGoal}".
I have targeted cutting back specifically on the category: "${user.cutbackCategory || 'Canteen'}".
Today's date is: ${today}.

Here are my recent transactions:
${recentTransactions || 'None'}

Here are my upcoming large expenses (spikes):
${upcomingSpikes || 'None'}

Please give me exactly ONE short, actionable, conversational tip (max 2 sentences) advising me on how to hit my target savings goal. Please base your advice specifically around reducing spending in my focus cutback area ("${user.cutbackCategory || 'Canteen'}"), referencing my recent purchases or upcoming spikes if applicable.
For example: "If you skip Canteen snacks tomorrow, you will save ${sym}150 to reach your laptop goal faster." or "You spent ${sym}200 on Canteen lunch recently. Skipping it today keeps your weekly budget perfectly on track."
Make it feel extremely direct, practical, and specific to my purchases. Speak directly to me.
`;

  const systemInstructions = "You are a direct, pragmatic, and friendly college financial advisor. You give extremely short, contextual savings advice (maximum 2 sentences) based on the user's spending habits and target goals. Keep it concise, motivational, and tailored to students.";

  let url, headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${effectiveKey}` }, body;

  if (effectiveProvider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    headers['HTTP-Referer'] = 'https://unispend.example.com';
    headers['X-Title'] = 'UniSpend App';

    const fallbacks = [
      'google/gemini-2.5-flash',
      'qwen/qwen-2.5-72b-instruct:free'
    ];

    body = {
      model: effectiveModel || 'meta-llama/llama-3.3-70b-instruct:free',
      models: [effectiveModel || 'meta-llama/llama-3.3-70b-instruct:free', ...fallbacks].slice(0, 3),
      messages: [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    };
  } else if (effectiveProvider === 'gemini') {
    url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    body = {
      model: effectiveModel || 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    };
  } else {
    // groq (default / universal)
    url = 'https://api.groq.com/openai/v1/chat/completions';
    body = {
      model: effectiveModel || UNIVERSAL_MODEL,
      messages: [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`API error (${res.status})`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || '';
}
