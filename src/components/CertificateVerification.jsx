import React, { useEffect, useState } from 'react';
import { learningRequest as request } from '../services/lifelong';
import './lifelong.css';

export default function CertificateVerification({ initialCode = '' }) {
  const [code,setCode]=useState(initialCode); const [record,setRecord]=useState(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function verify(value) { setBusy(true);setError('');setRecord(null);try{const rows=await request(db=>db.rpc('verify_certificate',{p_code:value.trim()}));if(!rows?.length) setError('No certificate found for this ID.');else setRecord(rows[0]);}catch(e){setError(e.message);}finally{setBusy(false);} }
  useEffect(()=>{if(initialCode) verify(initialCode);},[initialCode]);
  return <main className="content-band lifelong"><section className="lf-panel"><span className="eyebrow">NurseFaculty</span><h2>Verify a certificate</h2><form className="lf-toolbar" onSubmit={e=>{e.preventDefault();verify(code);}}><input aria-label="Certificate ID" required value={code} onChange={e=>setCode(e.target.value)} placeholder="Certificate ID"/><button disabled={busy} className="primary-btn">{busy?'Verifying…':'Verify'}</button></form>{error&&<p role="alert" className="lf-error">{error}</p>}{record&&<div role="status"><h3>{record.is_verified?'Valid certificate':'Certificate is not currently valid'}</h3><p>{record.title}</p><dl><dt>Recipient</dt><dd>{record.student_name}</dd><dt>Issuer</dt><dd>{record.institution_name}</dd><dt>Issued</dt><dd>{record.issued_at?.slice(0,10)}</dd><dt>Expires</dt><dd>{record.expires_at?.slice(0,10)||'No expiry'}</dd><dt>Status</dt><dd>{record.expires_at&&new Date(record.expires_at)<new Date()?'Expired':record.status}</dd><dt>Certificate ID</dt><dd>{record.certificate_number||record.verification_code}</dd></dl></div>}<a href="/">Return to NurseFaculty</a></section></main>;
}
