import { useStore } from '@nanostores/react'
import { useMemo } from 'react'

import { $connection } from '@/store/session'

function agentRoomUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/agent-room/?source=multitasker`
}

export function AgentRoomView() {
  const connection = useStore($connection)
  const src = useMemo(() => (connection?.baseUrl ? agentRoomUrl(connection.baseUrl) : ''), [connection?.baseUrl])

  return (
    <div className="flex h-full min-h-0 w-full bg-background pt-(--titlebar-height)">
      {src ? (
        <iframe
          className="h-full min-h-0 w-full border-0"
          src={src}
          title="Agent Room"
        />
      ) : null}
    </div>
  )
}
