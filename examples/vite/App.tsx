import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function App() {
  const [todos, setTodos] = useState<any[]>([])

  useEffect(() => {
    async function getTodos() {
      const { data: todosData, error } = await supabase.from('todos').select()
      if (error) {
        console.error('Supabase fetch error', error)
        return
      }

      if (todosData) {
        setTodos(todosData)
      }
    }

    getTodos()
  }, [])

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  )
}
