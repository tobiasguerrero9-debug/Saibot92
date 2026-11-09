import React from 'react';
import { Link } from 'react-router-dom';
import ExecutionSession from './ExecutionSession';
import './augustus.css';
export default function AugustusTerminal() {
  return <div className="augustus"><header className="aug-header"><Link to="/">← SAIBOT92</Link><span>AUGUSTUS92 <small>ETH EXECUTION LAYER</small></span><strong>HYPERLIQUID / TESTNET ONLY</strong></header><main><ExecutionSession /><footer>LOCAL DEVELOPMENT / TESTNET ONLY · ETH-PERP · One trade attempt per armed session</footer></main></div>;
}
