import React from 'react';
import Footer from '@/components/Footer';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <div className="max-w-4xl mx-auto px-6 py-8 pb-24">
        <h1 className="text-3xl font-semibold mb-8">Terms of Service</h1>
        
        <div className="space-y-6 text-gray-300">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
              <p className="mb-4">
                By accessing and using Mavrixfy, you accept and agree to be bound by the terms 
                and provision of this agreement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
              <p className="mb-4">
                Mavrixfy is a music discovery and playlist management platform that helps users 
                discover, organize, and enjoy music content.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. User Accounts</h2>
              <p className="mb-4">
                To access certain features, you may be required to create an account. You are 
                responsible for maintaining the confidentiality of your account credentials.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
              <p className="mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the service for any unlawful purpose</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Distribute malware or harmful content</li>
                <li>Attempt to gain unauthorized access to our systems</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Content and Copyright</h2>
              <p className="mb-4">
                All music content is provided through licensed third-party services. Users must 
                respect copyright laws and the terms of service of integrated platforms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Privacy</h2>
              <p className="mb-4">
                Your privacy is important to us. Please review our Privacy Policy, which also 
                governs your use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Disclaimers</h2>
              <p className="mb-4">
                The service is provided "as is" without any warranties, express or implied. 
                We do not guarantee uninterrupted or error-free service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Limitation of Liability</h2>
              <p className="mb-4">
                In no event shall Mavrixfy be liable for any indirect, incidental, special, 
                consequential, or punitive damages.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Termination</h2>
              <p className="mb-4">
                We may terminate or suspend your account and access to the service at our sole 
                discretion, without prior notice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Changes to Terms</h2>
              <p className="mb-4">
                We reserve the right to modify these terms at any time. Changes will be effective 
                immediately upon posting.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">11. Contact Information</h2>
              <p className="mb-4">
                For questions about these Terms of Service, please contact us at:
              </p>
              <p>Email: legal@mavrixfy.site</p>
              <p>Website: https://mavrixfy.site</p>
            </section>

            <div className="mt-8 pt-6 border-t border-gray-700">
              <p suppressHydrationWarning className="text-sm text-gray-400">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        
        <Footer />
      </div>
    </div>
  );
};

export default TermsOfService;
