/* Canvas models and six layered habitats. Geometry is shared with gameplay radii. */
(function(root){
  const habitats=[
    {name:'浅滩珊瑚',label:'01 / CORAL GARDEN',top:'#88e4dc',bottom:'#126f91',sand:'#e5c98c',accent:'#ffae83'},
    {name:'海草森林',label:'02 / KELP FOREST',top:'#77d3b2',bottom:'#145e65',sand:'#89aa79',accent:'#b0e48a'},
    {name:'沉船区',label:'03 / SUNKEN SHIP',top:'#67bed6',bottom:'#24436e',sand:'#a0a69c',accent:'#edc688'},
    {name:'深海峡谷',label:'04 / BLUE CANYON',top:'#4c9bbf',bottom:'#1e285e',sand:'#606d99',accent:'#aba6ff'},
    {name:'鲸落',label:'05 / WHALE SANCTUARY',top:'#458f9f',bottom:'#153c56',sand:'#69858b',accent:'#a5ecdc'},
    {name:'海底火山',label:'06 / VOLCANIC REEF',top:'#696ca8',bottom:'#29284d',sand:'#74617c',accent:'#ffae70'}
  ];
  function oval(c,x,y,rx,ry,color,angle=0){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();}
  function gradient(c,x,y,r,light,mid,dark){const g=c.createRadialGradient(x-r*.3,y-r*.4,r*.03,x,y,r);g.addColorStop(0,light);g.addColorStop(.58,mid);g.addColorStop(1,dark);return g;}
  function line(c,points,color,width){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.stroke();}
  const colors=[['#dbfff1','#7bd5b5','#279f98'],['#e0fbff','#7abfdd','#477cad'],['#ffead5','#f6aa8c','#ca6a76'],['#e8ddff','#a796dc','#6855ab'],['#fff9bd','#f5cb53','#d3832c']];
  function fish(c,x,y,r,kind,direction,time,hero=false){
    c.save();c.translate(x,y);c.scale(direction,1);
    const palette=hero?['#fff0b5','#ffbd65','#d56b42']:colors[kind],tail=Math.sin(time*7+x*.02)*.13;
    oval(c,0,r*.7,r*.9,r*.17,'#073b5526');
    // Tail, dorsal fin and belly fin sit behind the shaded body.
    c.save();c.translate(-r*.72,0);c.rotate(tail);c.fillStyle=gradient(c,-r*.4,0,r*.9,palette[0],palette[1],palette[2]);
    c.beginPath();c.moveTo(r*.18,0);c.bezierCurveTo(-r*.2,-r*.25,-r*.6,-r*.8,-r*.88,-r*.67);c.quadraticCurveTo(-r*.62,0,-r*.88,r*.67);c.bezierCurveTo(-r*.55,r*.8,-r*.12,r*.22,r*.18,0);c.fill();
    for(let i=-1;i<=1;i++)line(c,[[0,0],[-r*.63,i*r*.44]],palette[2]+'66',Math.max(.7,r*.025));c.restore();
    c.fillStyle=palette[2];c.beginPath();c.moveTo(-r*.6,-r*.3);c.quadraticCurveTo(-r*.42,-r*1.05,r*.05,-r*.91);c.lineTo(r*.4,-r*.35);c.fill();
    c.fillStyle=palette[1];c.beginPath();c.moveTo(-r*.4,r*.35);c.quadraticCurveTo(-r*.2,r,r*.25,r*.73);c.lineTo(r*.4,r*.35);c.fill();
    const round=kind===3&&!hero?.84:.68;
    oval(c,0,0,r,r*round,gradient(c,0,0,r,palette[0],palette[1],palette[2]));
    c.save();c.beginPath();c.ellipse(0,0,r,r*round,0,0,Math.PI*2);c.clip();
    oval(c,r*.12,r*.5,r*.83,r*.26,'#fff8d344');
    if(hero||kind===2){for(const xx of [-.55,-.06]){c.strokeStyle='#fff4ddaa';c.lineWidth=r*.12;c.beginPath();c.moveTo(xx*r,-r);c.quadraticCurveTo((xx-.3)*r,0,xx*r,r);c.stroke();}}
    if(kind===3&&!hero){for(let i=0;i<3;i++)oval(c,(-.5+i*.32)*r,-r*.1,r*.055,r*.055,'#65529c88');}
    c.restore();
    c.save();c.translate(-r*.12,r*.21);c.rotate(Math.sin(time*9)*.2);oval(c,0,0,r*.29,r*.18,gradient(c,0,0,r*.35,palette[0],palette[1],palette[2]),.45);c.restore();
    oval(c,r*.44,-r*.18,r*.26,r*.29,'#fffef1');oval(c,r*.53,-r*.15,r*.135,r*.17,'#224a5c');oval(c,r*.57,-r*.21,r*.045,r*.055,'#ffffff');
    oval(c,r*.48,r*.21,r*.16,r*.085,'#ff947b66');
    c.strokeStyle=palette[2];c.lineWidth=Math.max(.8,r*.035);c.beginPath();c.arc(r*.71,r*.14,r*.12,.15,2.2);c.stroke();
    oval(c,-r*.19,-r*.4,r*.32,r*.08,'#ffffff77',-.2);
    if(kind===4&&!hero){c.strokeStyle='#fff4ad';c.lineWidth=1.3;for(let i=0;i<3;i++){const a=time+i*2.1,xx=Math.cos(a)*r*1.5,yy=Math.sin(a)*r;line(c,[[xx-2,yy],[xx+2,yy]],'#fff4ad',1);line(c,[[xx,yy-2],[xx,yy+2]],'#fff4ad',1);}}
    c.restore();
  }
  function jelly(c,p,time,level){
    c.save();c.translate(p.x,p.y);const r=p.r,pulse=1+Math.sin(time*2.5+p.phase)*.045;
    const pal=level<4?['#ffe7fa','#c58acb','#755ba3']:['#daefff','#8f9ce5','#6052a4'];
    for(let i=-2;i<=2;i++){
      c.strokeStyle=i%2?'#f0c7efaa':'#bcabe7bb';c.lineWidth=r*.055;c.lineCap='round';c.beginPath();c.moveTo(i*r*.28,0);
      c.bezierCurveTo(i*r*.3+Math.sin(time*2+i)*r*.25,r*.3,i*r*.3-Math.sin(time*2+i)*r*.2,r*.6,i*r*.34,r*.9);c.stroke();
    }
    c.scale(pulse,pulse);c.fillStyle=gradient(c,0,-r*.22,r,pal[0],pal[1],pal[2]);c.beginPath();c.moveTo(-r,0);c.bezierCurveTo(-r,-r*.95,r,-r*.95,r,0);
    for(let i=4;i>=-4;i--)c.quadraticCurveTo(i*r*.24,r*.12,(i-.5)*r*.22,0);c.fill();
    oval(c,-r*.23,-r*.41,r*.37,r*.12,'#ffffff55',-.25);
    for(const xx of [-.28,.28]){oval(c,xx*r,-r*.15,r*.085,r*.1,'#fff6fc');oval(c,xx*r,-r*.13,r*.035,r*.045,'#4c407a');}
    oval(c,0,-r*.03,r*.055,r*.025,'#775787');c.restore();
  }
  function coral(c,x,y,s,color,time){
    c.save();c.translate(x,y);c.scale(s,s);const sway=Math.sin(time*.8+x)*2;
    line(c,[[0,0],[sway,-24],[sway-2,-57]],color,9);
    line(c,[[sway,-22],[-16,-35],[-18,-49]],color,7);line(c,[[sway,-34],[17,-45],[19,-61]],color,7);
    line(c,[[-16,-35],[-28,-38],[-30,-49]],color,5);
    line(c,[[sway-1,-10],[2,-31],[0,-52]],'#ffffff24',2);c.restore();
  }
  function background(c,level,deep,time,bubbles){
    const h=habitats[level-1],g=c.createLinearGradient(0,0,0,500);g.addColorStop(0,h.top);g.addColorStop(1,h.bottom);c.fillStyle=g;c.fillRect(0,0,400,500);
    // Soft sun shafts and distant seabed silhouettes give each scene depth.
    c.fillStyle='#e7ffff0c';for(let i=0;i<4;i++){const x=i*110+Math.sin(time*.15)*15;c.beginPath();c.moveTo(x,0);c.lineTo(x+30,0);c.lineTo(x+135,500);c.lineTo(x-20,500);c.fill();}
    for(let i=0;i<5;i++)oval(c,i*110-20,440,85,70,'#061d3d16');
    c.fillStyle=h.sand;c.beginPath();c.moveTo(0,500);c.lineTo(0,460);c.bezierCurveTo(80,438,130,484,240,457);c.quadraticCurveTo(330,439,400,465);c.lineTo(400,500);c.fill();
    if(level===1){
      coral(c,30,475,.85,'#e68f99',time);coral(c,360,477,.95,'#efab8e',time);coral(c,73,482,.5,'#d6b5cc',time);
      for(let i=0;i<5;i++)oval(c,145+i*9,476,5,8,'#f0dba8',i*.2);
      c.save();c.translate(290,477);c.fillStyle='#df9c78';c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?5:13;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.restore();
    }else if(level===2){
      for(let i=0;i<10;i++){const x=i<5?i*14:340+(i-5)*14,height=90+(i%4)*25,sway=Math.sin(time*.9+i)*10;
        line(c,[[x,490],[x+sway*.5,490-height*.5],[x+sway,490-height]],i%2?'#3f9873':'#66b685',3);
        for(let j=1;j<5;j++){const y=485-j*height/5;oval(c,x+sway*j/5+(j%2?7:-7),y,7,18,j%2?'#5eac80':'#84c49a',j%2?.55:-.55);}}
    }else if(level===3){
      c.save();c.translate(190,445);c.rotate(-.12);
      c.fillStyle='#725c59';c.beginPath();c.moveTo(-95,-22);c.lineTo(100,-22);c.quadraticCurveTo(70,35,-65,27);c.closePath();c.fill();
      for(let i=0;i<4;i++)line(c,[[-85,-12+i*9],[82-i*6,-12+i*9]],'#ac887166',2);
      line(c,[[0,15],[0,-116]],'#8f7a68',6);line(c,[[-41,-87],[46,-87]],'#8f7a68',4);
      c.fillStyle='#c6ccb59c';c.beginPath();c.moveTo(5,-112);c.lineTo(5,-35);c.quadraticCurveTo(52,-41,39,-55);c.lineTo(47,-60);c.quadraticCurveTo(18,-74,5,-112);c.fill();
      for(const x of [-45,-12,23,58]){oval(c,x,-6,8,8,'#cab78b');oval(c,x,-6,5,5,'#283e52');}c.restore();coral(c,346,482,.7,'#a99bb4',time);
    }else if(level===4){
      for(const side of [0,1]){c.save();if(side){c.translate(400,0);c.scale(-1,1);}const rock=c.createLinearGradient(0,0,100,0);rock.addColorStop(0,'#253355');rock.addColorStop(1,'#667ca3');c.fillStyle=rock;c.beginPath();c.moveTo(0,180);c.lineTo(30,207);c.lineTo(48,290);c.lineTo(72,325);c.lineTo(56,372);c.lineTo(95,500);c.lineTo(0,500);c.fill();line(c,[[27,220],[35,294],[58,330]],'#aec2d330',2);c.restore();}
      for(let i=0;i<9;i++)oval(c,70+i*32,445+Math.sin(i*2)*15,2,3,'#a3f3edaa');
    }else if(level===5){
      c.save();c.translate(205,458);c.rotate(-.08);line(c,[[-109,0],[88,0]],'#d4dfcd',7);
      for(let i=0;i<9;i++){const x=-85+i*19;c.strokeStyle='#d8e2cf';c.lineWidth=4;c.beginPath();c.ellipse(x,-10,12,25-i*.9,-.2,Math.PI,Math.PI*2);c.stroke();oval(c,x,0,4,5,'#f0efda');}
      oval(c,103,-4,23,13,'#d8e2cf',-.2);oval(c,110,-9,6,4,'#829c9a');c.restore();coral(c,34,478,.7,'#99c1b5',time);coral(c,355,480,.7,'#8ba6c3',time);
    }else{
      const glow=c.createRadialGradient(205,455,5,205,455,115);glow.addColorStop(0,'#ffb56288');glow.addColorStop(1,'#ffb56200');c.fillStyle=glow;c.fillRect(85,335,240,165);
      c.fillStyle='#55516d';c.beginPath();c.moveTo(105,500);c.lineTo(175,397);c.quadraticCurveTo(206,411,235,397);c.lineTo(305,500);c.fill();
      oval(c,205,400,31,8,'#d17867');oval(c,205,399,22,4,'#ffd794');
      line(c,[[195,411],[185,435],[203,448],[190,478]],'#f6a86e',3);line(c,[[226,426],[234,452],[252,474]],'#d98670',2);
      for(let i=0;i<9;i++){const y=400-((time*15+i*17)%95);oval(c,205+Math.sin(i+time)*12,y,2,2,'#ffd58c88');}
    }
    // Foreground stones and tiny shell details anchor the playable area.
    for(let i=0;i<9;i++){const x=(i*67+12)%400;oval(c,x,490+(i%2)*4,10+i%3*4,5,gradient(c,x,491,17,'#e6ead0',h.sand,h.bottom));}
    c.strokeStyle='#e0fff455';c.lineWidth=.8;for(const b of bubbles){c.beginPath();c.arc(b.x,b.y,b.r,0,Math.PI*2);c.stroke();oval(c,b.x-b.r*.3,b.y-b.r*.4,.6,.6,'#ffffffaa');}
    if(deep){c.fillStyle='#08284c33';c.fillRect(0,0,400,500);}
  }
  const api={habitats,fish,jelly,background};if(typeof module!=='undefined')module.exports=api;else root.FishArt=api;
})(globalThis);
