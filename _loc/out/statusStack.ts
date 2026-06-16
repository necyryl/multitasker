statusStack: {
    agents: 'Агенти',
    background: count => `${count} Фоновий процес${count === 1 ? '' : 'и'}`,
    subagents: count => `${count} Субагент${count === 1 ? '' : 'и'}`,
    todos: (done, total) => `Завдання ${done}/${total}`,
    running: 'Виконується',
    stop: 'Зупинити',
    dismiss: 'Відхилити',
    exit: code => `вихід ${code}`
  },
