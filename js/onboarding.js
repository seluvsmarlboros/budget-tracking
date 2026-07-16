/* Onboarding Controller module */
import { State } from './state.js';
import { SupabaseService, supabase } from './supabase.js';
import { toast } from './app.js';

export async function initOnboarding() {
  console.log('UniSpend: initOnboarding() triggered');

  const authCard = document.getElementById('onb-auth-card');
  const profileCard = document.getElementById('onb-profile-card');
  const otpForm = document.getElementById('onb-otp-form');

  let activeEmail = '';

  // 1. Initial State Check
  if (supabase) {
    const user = await SupabaseService.getCurrentUser();
    if (user) {
      // User is already authenticated, transition to profile setup directly
      authCard.style.display = 'none';
      profileCard.style.display = '';
    }

    // Auth status change listener
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Onboarding auth event:', event);
      if (event === 'SIGNED_IN') {
        toast('Authenticated successfully!');
        authCard.style.display = 'none';
        profileCard.style.display = '';
      }
    });
  }

  // 2. Auth Form Submit handler (Magic Link)
  const authForm = document.getElementById('onb-auth-form');
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('onb-email').value.trim();
      const btn = document.getElementById('onb-auth-btn');
      const msg = document.getElementById('onb-auth-msg');

      btn.disabled = true;
      btn.textContent = 'Sending Magic Link...';

      try {
        await SupabaseService.sendMagicLink(email, email.split('@')[0]);
        activeEmail = email;
        msg.textContent = `Magic link sent to ${email}! Click it to login, or enter the 6-digit code below.`;
        msg.style.display = '';
        
        // Show OTP code entry fallback
        if (otpForm) otpForm.style.display = '';
        toast('Sign in link sent!');
      } catch (err) {
        console.error(err);
        toast(`Error: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send Magic Link →';
      }
    });
  }

  // 3. OTP Verification Form handler
  if (otpForm) {
    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('onb-otp').value.trim();
      const btn = document.getElementById('onb-otp-btn');

      if (!activeEmail) {
        toast('Please submit your email first.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Verifying...';

      try {
        await SupabaseService.verifyOTP(activeEmail, token);
        toast('Code verified!');
        authCard.style.display = 'none';
        profileCard.style.display = '';
      } catch (err) {
        console.error(err);
        toast(`Verification failed: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Verify Code →';
      }
    });
  }

  // 4. Profile Setup Form Submit handler
  const profileForm = document.getElementById('onboard-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('UniSpend: Onboarding profile submitted');

      const name = document.getElementById('onb-name').value.trim();
      const currency = document.getElementById('onb-currency').value;
      const budget = document.getElementById('onb-budget').value;
      const seed = document.getElementById('onb-seed').checked;
      const goal = document.getElementById('onb-goal').value.trim();
      const cutback = document.getElementById('onb-cutback').value;

      if (!name || !budget) {
        toast('Please enter your name and budget.');
        return;
      }

      try {
        // Save profile metadata in Supabase
        if (supabase) {
          await SupabaseService.updateProfile({ displayName: name });
        }

        // Save local state
        State.completeOnboarding({
          name,
          currency,
          weeklyPocketMoney: budget,
          seedData: seed,
          targetGoal: goal,
          cutbackCategory: cutback
        });

        console.log('UniSpend: completeOnboarding executed. Persisted:', State.data);
        
        // Hide onboarding and reload
        document.getElementById('onboarding').style.display = 'none';
        document.getElementById('app').classList.remove('hidden');
        location.reload();
      } catch (err) {
        console.error('Onboarding profile save failed:', err);
        toast(`Failed to save: ${err.message}`);
      }
    });
  }
}
