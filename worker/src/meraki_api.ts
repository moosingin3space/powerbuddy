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
        'X-Cisco-Meraki-API-Key': MERAKI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ operation })
    }
  )

  // AI: refactor this code...

  if (!commandResponse.ok) {
    throw new Error(`Meraki API request failed: ${commandResponse.status}`)
  }

  const { commandId } = await commandResponse.json()

  // Exponential backoff parameters
  let retries = 0
  const maxRetries = 5
  const baseDelay = 1000
  let status: string

  do {
    // Wait with exponential backoff
    await setTimeout(baseDelay * 2 ** retries)
    
    // Check command status
    const statusResponse = await fetch(
      `https://api.meraki.com/api/v1/devices/${MERAKI_DEVICE_SERIAL}/sensor/commands/${commandId}`,
      {
        headers: {
          'X-Cisco-Meraki-API-Key': MERAKI_API_KEY
        }
      }
    )

    if (!statusResponse.ok) {
      throw new Error(`Failed to check command status: ${statusResponse.status}`)
    }

    const commandStatus = await statusResponse.json()
    status = commandStatus.status

    if (status === 'failed') {
      throw new Error(`Command failed: ${commandStatus.errors?.join(', ') || 'Unknown error'}`)
    }

    retries++
  } while (status !== 'completed' && retries < maxRetries)

  if (status !== 'completed') {
    throw new Error(`Command did not complete after ${maxRetries} retries`)
  }

  // Verify power state (requires separate sensor reading check)
  const sensorResponse = await fetch(
    `https://api.meraki.com/api/v1/devices/${MERAKI_DEVICE_SERIAL}/sensor/readings/latest`,
    {
      headers: {
        'X-Cisco-Meraki-API-Key': MERAKI_API_KEY
      }
    }
  )

  const [sensorData] = await sensorResponse.json()
  const currentPower = sensorData.downstreamPower?.powerStatus === 'connected'

  if (currentPower !== power) {
    throw new Error(`Power state verification failed. Expected ${power}, got ${currentPower}`)
  }

  // .. into another function that queries whether the power state is what it's intended to be. AI!
  // - This function does not have to perform exponential backoff itself, for that is apparently doable
  //   with the Cloudflare API itself. Do not use Cloudflare's API here. I'll do that myself in a surrounding
  //   caller.
}
