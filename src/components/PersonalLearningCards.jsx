import React, { useEffect, useState } from 'react';
import { learningRequest as request } from '../services/lifelong';

export default function PersonalLearningCards({ session }) {
  const [cards,setCards]=useState([]);const [index,setIndex]=useState(0);const [flipped,setFlipped]=useState(false);
  useEffect(()=>{if(session?.user?.id)request(db=>db.from('personal_learning_cards').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false})).then(setCards).catch(()=>{});},[session?.user?.id]);
  if(!cards.length)return null;
  const card=cards[index];
  return <section className="surface" style={{margin:'20px 0',padding:20}}><h3>My tutor flashcards</h3><p>AI-generated personal practice. Review against your course references.</p><p>{index+1} of {cards.length}</p><button className="ghost-btn" onClick={()=>setFlipped(!flipped)} style={{whiteSpace:'pre-wrap',textAlign:'left'}}>{flipped?card.back:card.front}</button><div><button className="ghost-btn" onClick={()=>{setIndex((index+cards.length-1)%cards.length);setFlipped(false);}}>Previous</button><button className="ghost-btn" onClick={()=>{setIndex((index+1)%cards.length);setFlipped(false);}}>Next</button></div></section>;
}
