async function set_mt40_power(
  api_key: string,
  mt40_serial: string,
  { power }: { power: boolean },
) {
  const operation = power ? 'enableDownstreamPower' : 'disableDownstreamPower'
  
  // Send command to Meraki API
  const commandResponse = await fetch(
    `https://api.meraki.com/api/v1/devices/${mt40_serial}/sensor/commands`,
    {
      method: 'POST',
      headers: {
        'X-Cisco-Meraki-API-Key': api_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ operation })
    }
  )

  if (!commandResponse.ok) {
    throw new Error(`Meraki API request failed: ${commandResponse.status}`)
  }

  const { commandId } = await commandResponse.json()
  return commandId
}

async function check_mt40_power_state(
  api_key: string,
  mt40_serial: string,
  expectedPower: boolean
) {
  const sensorResponse = await fetch(
    `https://api.meraki.com/api/v1/devices/${mt40_serial}/sensor/readings/latest`,
    {
      headers: {
        'X-Cisco-Meraki-API-Key': api_key
      }
    }
  )

  const [sensorData] = await sensorResponse.json()
  const currentPower = sensorData.downstreamPower?.powerStatus === 'connected'

  if (currentPower !== expectedPower) {
    throw new Error(`Power state verification failed. Expected ${expectedPower}, got ${currentPower}`)
  }
}

export async function meraki_api({ power }: { power: boolean }) {
  if (!process.env.MERAKI_API_KEY || !process.env.MERAKI_DEVICE_SERIAL) {
    throw new Error('Meraki API credentials not configured')
  }

  const commandId = await set_mt40_power(
    process.env.MERAKI_API_KEY,
    process.env.MERAKI_DEVICE_SERIAL,
    { power }
  )
  
  return {
    commandId,
    verify: () => check_mt40_power_state(
      process.env.MERAKI_API_KEY!,
      process.env.MERAKI_DEVICE_SERIAL!,
      power
    )
  }
}
