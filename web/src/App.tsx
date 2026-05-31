import { useState } from 'react'
import { CapturePage } from './pages/CapturePage'
import { LogPage } from './pages/LogPage'

type Tab = 'capture' | 'log'

export default function App() {
  const [tab, setTab] = useState<Tab>('capture')

  return (
    <div className="app">
      <header className="app__header">
        <h1>Calorie Tracker</h1>
      </header>

      <main className="app__main">
        {tab === 'capture' ? <CapturePage onLogged={() => setTab('log')} /> : <LogPage />}
      </main>

      <nav className="tabbar">
        <button
          className={`tabbar__btn ${tab === 'capture' ? 'is-active' : ''}`}
          onClick={() => setTab('capture')}
        >
          <span className="tabbar__icon">📷</span>
          Add
        </button>
        <button
          className={`tabbar__btn ${tab === 'log' ? 'is-active' : ''}`}
          onClick={() => setTab('log')}
        >
          <span className="tabbar__icon">📋</span>
          Log
        </button>
      </nav>
    </div>
  )
}
