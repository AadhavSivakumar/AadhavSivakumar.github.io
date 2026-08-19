// Temporary harness for iterating on Flourish3D: mounts ONLY the two
// flourishes on a plain page with a tall spacer, so scroll fraction maps
// straight onto the pieces' progress and the whole 340x660 stage is visible.
// Not part of the site; delete when the art pass is done.
import React from 'react';
import ReactDOM from 'react-dom/client';
import Flourish3D from './components/Flourish3D';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <div className="page-flourish-layer" aria-hidden="true">
    <Flourish3D side="left" />
    <Flourish3D side="right" />
  </div>
);
