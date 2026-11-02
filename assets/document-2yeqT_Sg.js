import{pdfLib as h}from"./vendor-Cn24aezz.js";import{g as d,r as k,m as w,a as P}from"./pdf-CPmX7lka.js";import{supportsPdf as b,canvasToAiImage as T,aiConfig as $}from"./client-CVpN-7vw.js";import{G as f}from"./index-CC9c_RRS.js";import{l as D}from"./ocr-BcXoLnxM.js";const u=28*1024*1024,A=6e5;async function B(t,e,n){const a=await h(),l=await P(t,e);if(n.length===l.getPageCount()&&!l.isEncrypted&&t.length<u)return f(new Blob([t]));const i=await a.PDFDocument.create();(await i.copyPages(l,n)).forEach(o=>i.addPage(o));const m=await i.save({useObjectStreams:!0});return f(new Blob([m]))}async function _({bytes:t,name:e,doc:n,idxs:a,preferPdf:l=$().sendPdf,onProgress:i,maxImages:m=40}){if(l&&b()&&t&&t.length<u)return i?.(.2,"Menyiapkan PDF untuk AI…"),{mode:"pdf",files:[{mime:"application/pdf",data:await B(t,e,a),name:e}],text:"",note:`Dokumen PDF terlampir (halaman ${a[0]+1}–${a[a.length-1]+1}).`};let o="";const c=[];for(let s=0;s<a.length;s++){const r=a[s]+1;i?.(s/a.length,`Membaca halaman ${r}`);const{lines:p}=await d(n,r);if(D(p)&&c.length<m){const g=await k(n,r,{scale:1.6});c.push(await T(g,.8)),o+=`

[Halaman ${r}] (lihat gambar halaman ${r} terlampir)`}else o+=`

[Halaman ${r}]
${w(p)}`;if(o.length>A){o+=`

[Dokumen dipotong: halaman setelah ${r} tidak disertakan karena terlalu panjang]`;break}}return{mode:c.length?"mixed":"text",files:c,text:o.trim()}}function C(t,e){const n=[];for(let a=0;a<t.length;a+=e)n.push(t.slice(a,a+e));return n}export{C as c,_ as p};
