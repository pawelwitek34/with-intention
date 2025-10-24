/**
 * @file Extension's option page which allows the user to add/delete URLs
 * and set a specific timeframe during which the extension runs/sleeps.
 */

import {
	createTime,
	toggleTimeFeature,
	toggleTimeFormat,
	setTime
} from './utils/time.js'

import { createItem, addItem } from './utils/list.js'

import {
	getWebhookConfig,
	saveWebhookConfig
} from './utils/webhook.js'

/**
 * Selectors
 */
const url_list = document.querySelector('.url-list')

const add_url_container = document.querySelector('.add-url-container')
const add_url_input = document.querySelector('.add-url-input')
const add_url_button = document.querySelector('.add-url-button')
const add_url_error = document.querySelector('.add-url-error')

const manage_time_toggle = document.querySelector('.manage-time-toggle')
const manage_time_toggle_checkbox = document.querySelector(
	'.manage-time-toggle-checkbox'
)
const time_edit_container = document.querySelector('.time-edit-container')
const time_edit_select = document.querySelector('.time-edit-select')
const time_edit_response = document.querySelector('.time-edit-response')
const time_edit_change_format = document.querySelector(
	'.time-edit-change-format'
)

const manage_webhook_toggle = document.querySelector('.manage-webhook-toggle')
const manage_webhook_toggle_checkbox = document.querySelector(
	'.manage-webhook-toggle-checkbox'
)
const webhook_edit_container = document.querySelector('.webhook-edit-container')
const webhook_url_input = document.querySelector('.webhook-url-input')
const webhook_save_button = document.querySelector('.webhook-save-button')
const webhook_response = document.querySelector('.webhook-response')

/**
 * Copy-related
 */
const showFormat = { gb: 'Show 24 hours format', us: 'Show 12 hours format' }

/**
 * Event listeners
 */

add_url_container.addEventListener('submit', (e) =>
	addItem(e, add_url_input.value, ({ message, uid, hostname }) => {
		if (message === 'SUCCESS') {
			const item = createItem(uid, hostname)
			url_list.appendChild(item)
			add_url_input.value = ''
			add_url_error.textContent = ''
		} else {
			add_url_error.textContent = message
		}
	})
)

add_url_input.addEventListener('input', (e) => {
	if (e.currentTarget.value) {
		add_url_button.classList.add('is-visible')
	} else {
		add_url_button.classList.remove('is-visible')
	}
})

manage_time_toggle.addEventListener('mouseenter', () => {
	manage_time_toggle.parentNode.classList.add('hover')
})
manage_time_toggle.addEventListener('mouseleave', () => {
	manage_time_toggle.parentNode.classList.remove('hover')
})

manage_time_toggle_checkbox.addEventListener('change', () =>
	toggleTimeFeature((state) => {
		manage_time_toggle_checkbox.value = state
		time_edit_container.classList.toggle('is-visible')
		manage_time_toggle_checkbox.parentNode.parentNode.classList.toggle(
			'is-visible'
		)
	})
)
time_edit_change_format.addEventListener('click', () => {
	toggleTimeFormat((is24Hrs) => {
		time_edit_change_format.textContent = is24Hrs
			? showFormat.gb
			: showFormat.us
	})
})
time_edit_select.addEventListener('change', (e) => {
	setTime(e, ({ id, index }) => {
		if (index) {
			const el = document.getElementById(id)
			el.value = index
		}
		// TODO: Make more elegant
		time_edit_response.textContent = 'Updated time.'
		setTimeout(() => {
			time_edit_response.textContent = ''
		}, 2000)
	})
})

/**
 * Webhook event listeners
 */
manage_webhook_toggle.addEventListener('mouseenter', () => {
	manage_webhook_toggle.parentNode.classList.add('hover')
})
manage_webhook_toggle.addEventListener('mouseleave', () => {
	manage_webhook_toggle.parentNode.classList.remove('hover')
})

manage_webhook_toggle_checkbox.addEventListener('change', async () => {
	const isEnabled = manage_webhook_toggle_checkbox.checked
	webhook_edit_container.classList.toggle('is-visible')
	manage_webhook_toggle_checkbox.parentNode.parentNode.classList.toggle(
		'is-visible'
	)

	// If disabling, save immediately
	if (!isEnabled) {
		try {
			await saveWebhookConfig(false, webhook_url_input.value)
			webhook_response.textContent = 'Webhook disabled.'
			webhook_response.style.color = 'var(--color-text-secondary)'
			setTimeout(() => {
				webhook_response.textContent = ''
			}, 2000)
		} catch (error) {
			webhook_response.textContent = 'Error saving settings.'
			webhook_response.style.color = 'var(--color-text-destructive)'
		}
	}
})

webhook_save_button.addEventListener('click', async () => {
	const url = webhook_url_input.value.trim()
	const isEnabled = manage_webhook_toggle_checkbox.checked

	// Validate URL
	if (!url) {
		webhook_response.textContent = 'Please enter a webhook URL.'
		webhook_response.style.color = 'var(--color-text-destructive)'
		return
	}

	// Validate URL format
	try {
		const urlObj = new URL(url)
		if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
			throw new Error('Invalid protocol')
		}
	} catch (error) {
		webhook_response.textContent = 'Please enter a valid URL (https://...).'
		webhook_response.style.color = 'var(--color-text-destructive)'
		return
	}

	// Save webhook config
	try {
		await saveWebhookConfig(isEnabled, url)
		webhook_response.textContent = 'Webhook settings saved successfully!'
		webhook_response.style.color = '#4caf50'
		setTimeout(() => {
			webhook_response.textContent = ''
		}, 3000)
	} catch (error) {
		webhook_response.textContent = 'Error saving webhook settings.'
		webhook_response.style.color = 'var(--color-text-destructive)'
	}
})

/**
 * Setup
 */
chrome.storage.local.get(undefined, async ({ sites, time }) => {
	Object.keys(sites).forEach((e) => {
		url_list.appendChild(createItem(e, sites[e]))
	})

	const from = document.getElementById('from')
	const to = document.getElementById('to')

	if (time.active) {
		time_edit_container.classList.add('is-visible')
		manage_time_toggle_checkbox.parentNode.parentNode.classList.toggle(
			'is-visible'
		)
		manage_time_toggle_checkbox.checked = true
	}

	let interval, str
	const is24Hrs = time.use24Hrs

	if (is24Hrs) {
		interval = 30
		str = 'en-GB'
		from.appendChild(createTime({ interval, str }))
		to.appendChild(createTime({ interval, str }))
	} else {
		interval = 30
		str = 'en-US'
		from.appendChild(createTime({ interval, str }))
		to.appendChild(createTime({ interval, str }))
	}

	from.value = time.from
	to.value = time.to

	time_edit_change_format.appendChild(
		document.createTextNode(is24Hrs ? showFormat.us : showFormat.gb)
	)

	// Load webhook settings
	try {
		const webhookConfig = await getWebhookConfig()
		if (webhookConfig.enabled) {
			manage_webhook_toggle_checkbox.checked = true
			webhook_edit_container.classList.add('is-visible')
			manage_webhook_toggle_checkbox.parentNode.parentNode.classList.add(
				'is-visible'
			)
		}
		if (webhookConfig.url) {
			webhook_url_input.value = webhookConfig.url
		}
	} catch (error) {
		console.error('Error loading webhook config:', error)
	}
})
