import React from 'react';

export const LEGAL_VERSION = '2026-08-08';

const TERMS = [
  ['Eligibility and Accounts', 'Provide accurate, current account information and protect your credentials. Account sharing, impersonation, unauthorized access, and attempts to bypass platform controls are prohibited. NurseFaculty may suspend or terminate accounts involved in fraud, misuse, unauthorized access, or serious violations.'],
  ['Educational Purpose', 'NurseFaculty provides nursing education and professional-development resources. Content, explanations, examinations, and AI output are for education and training and do not replace professional medical judgment, institutional policy, clinical protocols, regulatory guidance, or qualified healthcare advice. Verify clinical information before patient-care use.'],
  ['Study Coach and Artificial Intelligence', 'Study Coach, rationale explanations, quiz generation, and planning may use AI. AI output can be incomplete, inaccurate, or outdated and is educational assistance, not authoritative clinical guidance. Usage limits may depend on your plan. Harmful, unlawful, or academically dishonest use is prohibited.'],
  ['Courses and LMS', 'Authorized instructors may create courses, lessons, assignments, assessments, and live sessions and invite students using approved enrollment methods. Enrollment does not guarantee completion, certification, licensure, regulatory recognition, or employment. Learners must satisfy course requirements.'],
  ['Instructor Responsibilities', 'Instructors are responsible for lawful, accurate, appropriate materials. Do not upload content that infringes copyright, confidentiality, patient privacy, or third-party rights. Educational clinical cases must not contain identifiable patient information without lawful authorization.'],
  ['Assessments and Academic Integrity', 'Do not obtain or share restricted examinations, manipulate results, submit another person’s work, use prohibited assistance, interfere with grading, or circumvent examination controls. Results may be invalidated and accounts suspended where credible misconduct exists.'],
  ['Certificates', 'Certificates, badges, attendance credentials, and records may require module completion, minimum scores, attendance, assessments, or instructor approval. They do not constitute professional licensure or accreditation unless expressly recognized by the relevant authority. Fraudulent alteration is prohibited; credentials issued in error or obtained through fraud may be corrected or revoked.'],
  ['Subscriptions and Payments', 'Pricing, duration, and included features are displayed before purchase. Payments may be processed by authorized third parties. Paid access may end at expiry unless renewed; expiry does not normally delete the account or legitimate earned certificates.'],
  ['Promotions', 'Promotional codes, trials, referrals, and institutional pricing may have dates, plan restrictions, eligibility rules, and usage limits. They have no cash value and may be cancelled for abuse, fraud, technical error, or unauthorized distribution.'],
  ['Intellectual Property', 'Unless stated otherwise, NurseFaculty owns or lawfully uses its software, branding, question banks, writing, and graphics. Scraping, cloning, reselling, commercial redistribution, copyright removal, and substantial reproduction are prohibited. Instructors grant the limited rights needed to host and deliver uploaded materials.'],
  ['Privacy and Personal Data', 'Personal information is processed to provide the service and should be handled under applicable requirements, including Ghana’s Data Protection Act, 2012 (Act 843). The separate Privacy Policy describes collection, use, retention, third parties, and user rights.'],
  ['Institution Accounts', 'Institutions may purchase seats and manage associated authorized users. Institutions must ensure invited persons are authorized. Access may be restricted when subscriptions expire or seat limits are exceeded.'],
  ['Availability and Third Parties', 'Continuous availability is not guaranteed. Maintenance, security work, connectivity, hosting, payment, email, video, analytics, authentication, or AI providers can interrupt service. Third-party services may have their own terms.'],
  ['Prohibited Conduct', 'Do not hack, probe, bypass subscriptions, exploit vulnerabilities, introduce malware, scrape restricted content, create fraudulent accounts, manipulate payments or offers, harass users, upload unlawful material, or use NurseFaculty illegally.'],
  ['Suspension and Termination', 'Serious or repeated violations may lead to suspension or termination. Where appropriate, users may be notified and may contact support. Termination does not extinguish prior lawful rights or outstanding payment obligations.'],
  ['Liability', 'To the extent permitted by law, NurseFaculty is not responsible for indirect or consequential loss caused by inappropriate reliance on educational material, user content, third-party services, or temporary interruptions. Liability that cannot lawfully be excluded remains unaffected.'],
  ['Changes, Governing Law and Contact', 'Material updates may be communicated through the platform or email. These Terms are governed by the laws of the Republic of Ghana, subject to mandatory rights elsewhere. Electronic agreements are recognized under the Electronic Transactions Act, 2008 (Act 772). Questions should be sent to the official support contact shown on NurseFaculty.'],
];

const REFUNDS = [
  ['General Principle', 'Digital educational services may become available immediately. Refunds are assessed according to access or consumption, the nature of the problem, and the circumstances. Mandatory consumer rights are not limited.'],
  ['Seven-Day Request Window', 'An individual may request a refund within seven calendar days of an initial purchase for an accidental purchase, duplicate charge, successful payment without activation, a substantial unresolved technical defect, or another genuine billing error. A request is not automatic approval.'],
  ['Duplicate Payments and Failed Activation', 'Confirmed duplicate charges should be refunded in full while the legitimate transaction remains active. If paid access was not delivered, NurseFaculty will first try to restore it; if that cannot reasonably be done, a full refund or an agreed remedy may be provided.'],
  ['Technical Problems', 'Contact support promptly. A full or partial refund may be considered when NurseFaculty confirms a substantial platform defect prevented meaningful use and could not reasonably be resolved.'],
  ['Change of Mind and Consumption', 'Change-of-mind requests may be declined after substantial digital use, including significant course completion, multiple premium exams, extensive question-bank or Study Coach use, restricted downloads, or certificate issuance, unless law requires otherwise.'],
  ['Renewals and Trials', 'Cancellation normally prevents the next renewal and does not refund the current period. Prompt requests for unintended renewals may be considered where little or no post-renewal use occurred. A genuinely free trial has no refundable payment; any paid conversion and price should be disclosed before charging.'],
  ['Promo Codes', 'The maximum refund is the amount actually paid after discounts, not the original price. Promotional value has no independent cash value.'],
  ['Institutions and Certificates', 'Institutional or bulk purchases may use separate contract terms. Completed-course or issued-certificate fees are ordinarily not refundable solely because the learner no longer needs the credential, but duplicate payment, delivery failure, incorrect issuance, and substantial platform errors remain reviewable.'],
  ['Abuse', 'Requests involving suspected fraud, repeat purchase/refund cycles, promotion manipulation, chargeback abuse, multiple offer accounts, or substantial consumption may be rejected while respecting applicable rights.'],
  ['Method and Timing', 'Approved refunds are normally returned through the original payment method and initiated within 5–10 business days. The provider, bank, or Mobile Money operator controls when funds finally appear. Never send payment credentials to individual staff members.'],
  ['How to Request', 'Use Account → Billing → Transactions → Select Payment → Request Refund. Provide the transaction ID, payment date, plan or course, amount, reason, and optional evidence. Statuses are Submitted, Under Review, Approved, Rejected, Refund Processing, and Refunded.'],
  ['Decisions', 'Refund records include requester, transaction, paid and refund amounts, reason, reviewer, decision date, provider reference, and status. Only authorized Finance or Admin personnel may decide or process refunds; ordinary users cannot modify transactions.'],
];

export default function LegalDocumentView({ type }) {
  const refund = type === 'refund';
  const supplemental = type === 'privacy' || type === 'cookie';
  const title = type === 'privacy' ? 'Privacy Policy' : type === 'cookie' ? 'Cookie Policy' : refund ? 'Refund Policy' : 'Terms and Conditions';
  const sections = supplemental ? [] : refund ? REFUNDS : TERMS;
  return (
    <main className="legal-page">
      <a className="legal-brand" href="/"><img src="/nursefaculty-mark.png" alt="" /><strong>NurseFaculty</strong></a>
      <article className="legal-document">
        <span className="eyebrow">NurseFaculty legal</span>
        <h1>{title}</h1>
        <p><strong>Effective date:</strong> 8 August 2026 · <strong>Version:</strong> {LEGAL_VERSION}</p>
        {!refund && !supplemental && <p>By creating an account, purchasing a subscription, joining a course, or using NurseFaculty, you agree to these Terms and Conditions.</p>}
        {supplemental && <section><h2>Policy review in progress</h2><p>This separate policy is being prepared for legal review. NurseFaculty will publish the complete policy before relying on it for production consent. For personal-data or cookie questions, contact the official NurseFaculty support address.</p></section>}
        {sections.map(([heading, body], index) => <section key={heading}><h2>{index + 1}. {heading}</h2><p>{body}</p></section>)}
        <aside>This policy draft requires review by a qualified Ghanaian lawyer before final production reliance.</aside>
      </article>
      <nav className="legal-links"><a href="/?legal=terms">Terms &amp; Conditions</a><a href="/?legal=refund">Refund Policy</a><a href="/?legal=privacy">Privacy Policy</a><a href="/?legal=cookie">Cookie Policy</a></nav>
    </main>
  );
}
