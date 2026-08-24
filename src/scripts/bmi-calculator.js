(function(){
  'use strict';
  const form = document.getElementById('bmi-form');
  if(!form) return;
  
  form.addEventListener('submit', function(e){
    e.preventDefault();
    const w = parseFloat(document.getElementById('weight').value);
    const h = parseFloat(document.getElementById('height').value);
    const age = parseInt(document.getElementById('age').value);
    const unit = document.getElementById('unit').value;
    
    if(!w||!h||w<=0||h<=0){
      document.getElementById('bmi-error').textContent='Enter valid positive numbers.';
      document.getElementById('bmi-error').hidden=false;
      return;
    }
    
    const bmi = unit==='metric' 
      ? Math.round(w/((h/100)**2)*10)/10 
      : Math.round((w*703)/(h**2)*10)/10;
    
    let cat, color;
    if(age>=65){
      if(bmi<22){cat='Underweight (increased risk)';color='var(--color-evidence-low)';}
      else if(bmi<27){cat='Optimal for older adults';color='var(--color-evidence-high)';}
      else if(bmi<30){cat='Overweight (monitor)';color='var(--color-evidence-mod)';}
      else{cat='Obese (consult provider)';color='var(--color-evidence-low)';}
    } else {
      if(bmi<18.5){cat='Underweight';color='var(--color-evidence-mod)';}
      else if(bmi<25){cat='Normal weight';color='var(--color-evidence-high)';}
      else if(bmi<30){cat='Overweight';color='var(--color-evidence-mod)';}
      else{cat='Obese';color='var(--color-evidence-low)';}
    }
    
    const r = document.getElementById('bmi-result');
    r.innerHTML=`<div class="bmi-result" role="alert"><span class="bmi-result__value" style="color:${color}">${bmi}</span><span class="bmi-result__category">${cat}</span><p class="bmi-result__note">Screening tool only. Consult your provider.</p></div>`;
    r.hidden=false;
  });
})();
