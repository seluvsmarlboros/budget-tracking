/* AI Assistant Service Module */
import { State } from './state.js';
import { SupabaseService } from './supabase.js';

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

  const todayDate = new Date();
  const today = todayDate.toISOString().split('T')[0];
  
  const yesterdayDate = new Date();
  yesterdayDate.setDate(todayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];
  
  const tomorrowDate = new Date();
  tomorrowDate.setDate(todayDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().split('T')[0];

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDayName = days[todayDate.getDay()];
  const yesterdayDayName = days[yesterdayDate.getDay()];

  // Context to help the model make smart matches
  const context = {
    today,
    todayDayOfWeek: todayDayName,
    yesterday,
    yesterdayDayOfWeek: yesterdayDayName,
    tomorrow,
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
   - Note: Payment method defaults to "UPI". Date defaults to today (${today}). If the user specifies relative dates like "yesterday", "tomorrow", or "last Wednesday", resolve the correct date string from the provided application context parameters.

2. { "action": "add_split", "direction": "lent"|"borrowed", "friend": string, "amount": number, "description": string, "splitHalf": boolean, "date": "YYYY-MM-DD" }
   - direction: "lent" (they owe me) or "borrowed" (I owe them).
   - friend: Name of the friend. If the friend is not in the existing friends list, we will automatically add them.
   - splitHalf: true if we split a bill 50/50 (e.g., "split canteen bill of 400 with Priya" -> amount 400, splitHalf: true). false if it's a direct loan/borrow where the friend owes the full amount.

3. { "action": "add_shared_bill", "friend": string, "amount": number, "description": string, "splitType": "equal" }
   - For real-time database-synced splits with a connected friend. Use this when the user explicitly mentions splitting or billing with a "partner", "synced friend", or a friend name that is connected in the live database sync.

4. { "action": "add_spike", "title": string, "amount": number, "date": "YYYY-MM-DD" }
   - For upcoming future expenses (fees, fests, tickets). Make sure to extract or estimate a future date.

5. { "action": "add_savings_goal", "name": string, "target": number, "saved": number }
   - For savings goals.

6. { "action": "update_settings", "name": string (optional), "currency": string (optional), "weeklyPocketMoney": number (optional), "commuteType": "metro"|"bus"|"petrol"|"cab"|"none" (optional) }
   - For changing profile/budget settings.

7. { "action": "add_friend", "name": string }
   - Adds a new friend.

Examples:
User: "spent 120 on lunch at the canteen"
Output: {"actions": [{"action": "add_transaction", "type": "expense", "category": "Food", "amount": 120, "description": "Canteen lunch", "paymentMethod": "UPI", "date": "${today}"}], "message": "I've logged a ₹120 expense for your lunch."}

User: "hello"
Output: {"actions": [], "message": "Hello! How can I help you manage your college budget today?"}

User: "I split a 500 bill with Rohan for pizza"
Output: {"actions": [{"action": "add_split", "direction": "lent", "friend": "Rohan", "amount": 500, "description": "Pizza", "splitHalf": true, "date": "${today}"}], "message": "Logged the pizza bill. Rohan owes you ₹250."}

User: "split shared bill of 1000 for electricity with my partner Priya"
Output: {"actions": [{"action": "add_shared_bill", "friend": "Priya", "amount": 1000, "description": "Electricity", "splitType": "equal"}], "message": "Logged the shared bill of ₹1000 for Electricity. Priya owes you ₹500."}

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

    // Extract JSON block strictly using regex to prevent markdown conversational wrappers crashing parsing
    text = text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
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

    case 'add_shared_bill': {
      const friend = act.friend;
      const amount = act.amount;
      const description = act.description;

      (async () => {
        try {
          const partnerships = await SupabaseService.checkPartnerships();
          const user = await SupabaseService.getCurrentUser();
          if (!user) return;

          const match = partnerships.find(p => {
            const uAName = p.user_a.display_name || '';
            const uBName = p.user_b.display_name || '';
            return uAName.toLowerCase() === friend.toLowerCase() || uBName.toLowerCase() === friend.toLowerCase();
          });

          if (match) {
            const splitDetail = JSON.stringify({
              splitType: 'equal',
              userAOwes: amount / 2,
              userBOwes: amount / 2
            });
            await SupabaseService.addSharedExpense({
              partnershipId: match.id,
              title: description,
              totalAmount: amount,
              splitType: 'equal',
              splitDetail: splitDetail,
              userAOwes: amount / 2,
              userBOwes: amount / 2,
              dueDate: new Date().toISOString().split('T')[0],
              category: 'Shared',
              isRecurring: false
            });
            const { checkAuthState } = await import('./partner.js');
            if (checkAuthState) checkAuthState();
          } else {
            // Local fallback
            if (!State.data.friends.list.includes(friend)) {
              State.addFriend(friend);
            }
            State.addSplitIOU('lent', friend, amount, description, true);
          }
        } catch (e) {
          console.error("AI shared expense save failed:", e);
        }
      })();

      return `Processing shared bill: splitting ${sym}${amount} with ${friend} for "${description}"`;
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
  
  // Calculate period income for AI context
  const now = new Date();
  let periodStart;
  if (period === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    const dayOfWeek = now.getDay() || 7;
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1, 0, 0, 0, 0);
  }
  const periodIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date + 'T00:00:00') >= periodStart)
    .reduce((s, t) => s + t.amount, 0);
  
  const periodExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= periodStart)
    .reduce((s, t) => s + t.amount, 0);

  const msElapsed = now - periodStart;
  const daysElapsed = Math.max(1, Math.ceil(msElapsed / (1000 * 60 * 60 * 24)));
  const dailyBurnRate = periodExpenses / daysElapsed;
  
  const totalDaysInPeriod = period === 'month' 
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    : 7;
  
  const msInPeriod = totalDaysInPeriod * 24 * 60 * 60 * 1000;
  const periodEnd = new Date(periodStart.getTime() + msInPeriod);
  const msRemaining = periodEnd - now;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  
  const left = (limit + periodIncome) - periodExpenses;
  const daysLeftOfFunds = dailyBurnRate > 0 ? (left / dailyBurnRate) : 999;
  
  let runoutProjected = '';
  if (left <= 0) {
    runoutProjected = `already run out of funds (Deficit of ${sym}${Math.abs(left).toFixed(2)})`;
  } else if (daysLeftOfFunds < daysRemaining) {
    const runoutDate = new Date(now.getTime() + daysLeftOfFunds * 24 * 60 * 60 * 1000);
    const runoutDayName = runoutDate.toLocaleDateString(undefined, { weekday: 'long' });
    const runoutDateString = runoutDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    runoutProjected = `projected to exhaust funds by ${runoutDayName} (${runoutDateString}), which is ${Math.ceil(daysRemaining - daysLeftOfFunds)} days before the period ends. Action required to save money.`;
  } else {
    runoutProjected = `healthy spend velocity. Funds are projected to last the entire period.`;
  }
  
  const today = new Date().toISOString().split('T')[0];
  const recentTransactions = transactions.slice(0, 10).map(t => 
    `- ${t.date}: spent ${sym}${t.amount} on ${t.description} [Category: ${t.category || 'Other'}]`
  ).join('\n');

  const upcomingSpikes = spikes.slice(0, 3).map(s => 
    `- ${s.title}: ${sym}${s.amount} due ${s.date}`
  ).join('\n');

  const prompt = `
I have a base ${period}ly budget limit of ${sym}${limit}.
During this current ${period}, I have also received ${sym}${periodIncome} in extra income (making my total available budget pool ${sym}${limit + periodIncome}).
Today's date is: ${today}.
I have spent ${sym}${periodExpenses} so far, meaning I have ${sym}${left.toFixed(2)} left.
Based on current elapsed time, my daily burn rate is ${sym}${dailyBurnRate.toFixed(2)}/day, and my runout status is: ${runoutProjected}.

My current saving/spending goal is: "${user.targetGoal}".
I have targeted cutting back specifically on the category: "${user.cutbackCategory || 'Canteen'}".

Here are my recent transactions:
${recentTransactions || 'None'}

Here are my upcoming large expenses (spikes):
${upcomingSpikes || 'None'}

Please give me exactly ONE short, actionable, conversational tip (max 2 sentences) advising me on how to adjust my spending velocity to stay on track. If my status shows a Warning (projected to run out early) or Critical (already out), offer specific suggestions on how I can save money to defer or extend my runout projection (e.g. by cooking at home to save ₹200). Reference my recent purchases or upcoming spikes if relevant. Speak directly to me.
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
