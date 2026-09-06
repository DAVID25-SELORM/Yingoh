import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import StudentDashboard from './StudentDashboard';
import LifelongLearning from './LifelongLearning';

export default function LearningDashboard({ session, onNavigate }) {
  const [stage,setStage]=useState(null);
  useEffect(()=>{let active=true;
    if(!supabase){setStage('nclex');return;}
    supabase.from('learning_profiles').select('career_stage').eq('user_id',session.user.id).maybeSingle().then(({data})=>{if(active)setStage(data?.career_stage||'nclex');}).catch(()=>{if(active)setStage('nclex');});
    return()=>{active=false;};
  },[session.user.id]);
  if(stage===null)return <p role="status">Loading your dashboard…</p>;
  return ['practicing','educator','leader'].includes(stage)?<LifelongLearning session={session} onNavigate={onNavigate}/>:<StudentDashboard session={session} onNavigate={onNavigate}/>;
}
