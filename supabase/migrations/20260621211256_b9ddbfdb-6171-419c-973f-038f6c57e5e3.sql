UPDATE public.integration_settings
SET google_calendar_id = 'primary',
    updated_at = now()
WHERE user_id = '4a182c81-6bc5-4373-be6d-34a9f6b7e61d';