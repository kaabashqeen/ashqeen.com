"use strict";
function probability(n,k,h){let miss=1;for(let i=0;i<h;i++)miss*=Math.max(0,n-k-i)/(n-i);return 1-miss;}
function drawHand(n,k,h){const deck=Array.from({length:n},(_,i)=>i<k);for(let i=0;i<h;i++){const j=i+Math.floor(Math.random()*(n-i));[deck[i],deck[j]]=[deck[j],deck[i]];}return deck.slice(0,h);}
function update(event){if(event)event.preventDefault();const n=Number(document.querySelector('#size').value),k=Number(document.querySelector('#copies').value),h=Number(document.querySelector('#draw').value);document.querySelector('#copies').max=n;
const valid=[n,k,h].every(Number.isInteger)&&n>=40&&n<=60&&k>=0&&k<=n&&h>=1&&h<=6;
document.querySelector('#error').textContent=valid?'':'Enter a deck of 40–60 cards, matching cards between 0 and deck size, and a hand of 1–6 cards.';
if(!valid){document.querySelector('#probability').textContent='';document.querySelector('#explanation').textContent='';document.querySelector('#hand').replaceChildren();document.querySelector('#sample-summary').textContent='';return;}
document.querySelector('#probability').textContent=(100*probability(n,k,h)).toFixed(1)+'%';document.querySelector('#explanation').textContent=`Chance of at least one match when drawing ${h} cards from ${n}, with ${k} matching cards.`;
const hand=drawHand(n,k,h);document.querySelector('#hand').replaceChildren(...hand.map(match=>{const el=document.createElement('div');el.className='card'+(match?' match':'');el.textContent=match?'Match':'Other card';return el;}));const matches=hand.filter(Boolean).length;document.querySelector('#sample-summary').textContent=`This sample: ${matches} matching ${matches===1?'card':'cards'}. Calculate again for a new hand.`;}
if(typeof document!=='undefined'){document.querySelector('#probability-form').addEventListener('submit',update);document.querySelector('#size').addEventListener('input',()=>{document.querySelector('#copies').max=document.querySelector('#size').value;});update();}
if(typeof module!=='undefined')module.exports={probability,drawHand};
