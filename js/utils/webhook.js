/**
 * @file Webhook utility functions for sending intention data to external services.
 */

/**
 * Get webhook configuration from chrome storage.
 * @returns {Promise<{enabled: boolean, url: string}>} Webhook config
 */
export async function getWebhookConfig() {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get('webhook', ({ webhook }) => {
			if (chrome.runtime.lastError) {
				return reject(chrome.runtime.lastError)
			}

			// Default values if webhook config doesn't exist
			const config = webhook || { enabled: false, url: '' }
			resolve(config)
		})
	})
}

/**
 * Save webhook configuration to chrome storage.
 * @param {boolean} enabled - Whether webhook is enabled
 * @param {string} url - Webhook URL
 * @returns {Promise<boolean>} Success status
 */
export async function saveWebhookConfig(enabled, url) {
	return new Promise((resolve, reject) => {
		const webhook = { enabled, url }

		chrome.storage.local.set({ webhook }, () => {
			if (chrome.runtime.lastError) {
				return reject(chrome.runtime.lastError)
			}
			console.log('Saved webhook config:', webhook)
			resolve(true)
		})
	})
}

/**
 * Send webhook with intention data.
 * @param {string} intention - User's intention text
 * @param {string} url - Current page URL
 * @returns {Promise<{success: boolean, message: string}>} Result of webhook call
 */
export async function sendWebhook(intention, url) {
	try {
		// Get webhook configuration
		const config = await getWebhookConfig()

		// If webhook is not enabled, return success without sending
		if (!config.enabled || !config.url) {
			return { success: true, message: 'Webhook not enabled' }
		}

		// Prepare payload
		const payload = {
			intention: intention,
			url: url,
			timestamp: new Date().toISOString()
		}

		console.log('Sending webhook to:', config.url, payload)

		// Send webhook with retry logic
		const result = await sendWithRetry(config.url, payload)
		return result

	} catch (error) {
		console.error('Webhook error:', error)
		return {
			success: false,
			message: error.message || 'Unknown error'
		}
	}
}

/**
 * Send HTTP POST request with retry logic.
 * @param {string} webhookUrl - Webhook URL
 * @param {object} payload - Data to send
 * @param {number} retryCount - Current retry attempt (internal)
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendWithRetry(webhookUrl, payload, retryCount = 0) {
	const MAX_RETRIES = 1
	const RETRY_DELAY = 5000 // 5 seconds
	const TIMEOUT = 10000 // 10 seconds

	try {
		// Create abort controller for timeout
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

		// Send POST request
		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
			signal: controller.signal
		})

		clearTimeout(timeoutId)

		// Check if response is OK (status 200-299)
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`)
		}

		console.log('Webhook sent successfully:', response.status)
		return {
			success: true,
			message: `Sent successfully (${response.status})`
		}

	} catch (error) {
		console.error(`Webhook attempt ${retryCount + 1} failed:`, error)

		// Retry logic
		if (retryCount < MAX_RETRIES) {
			console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`)
			await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
			return sendWithRetry(webhookUrl, payload, retryCount + 1)
		}

		// All retries exhausted
		const errorMessage = error.name === 'AbortError'
			? 'Request timeout'
			: error.message || 'Network error'

		return {
			success: false,
			message: errorMessage
		}
	}
}
