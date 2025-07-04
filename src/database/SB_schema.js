{
	"database_schema": [
		{
			"table_name": "reminders",
			"table_comment": null,
			"columns": [
				{
					"column_name": "id",
					"data_type": "integer",
					"is_nullable": "NO",
					"column_default": "nextval('reminders_id_seq'::regclass)",
					"comment": null
				},
				{
					"column_name": "client_id",
					"data_type": "integer",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "record_id",
					"data_type": "integer",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "appointment_datetime",
					"data_type": "timestamp without time zone",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "day_before_sent",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "false",
					"comment": null
				},
				{
					"column_name": "day_before_sent_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "day_before_confirmed",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "false",
					"comment": null
				},
				{
					"column_name": "hour_before_sent",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "false",
					"comment": null
				},
				{
					"column_name": "hour_before_sent_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "status",
					"data_type": "character varying",
					"is_nullable": "YES",
					"column_default": "'pending'::character varying",
					"comment": null
				},
				{
					"column_name": "metadata",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'{}'::jsonb",
					"comment": null
				},
				{
					"column_name": "created_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "CURRENT_TIMESTAMP",
					"comment": null
				},
				{
					"column_name": "updated_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "CURRENT_TIMESTAMP",
					"comment": null
				}
			]
		},
		{
			"table_name": "clients",
			"table_comment": null,
			"columns": [
				{
					"column_name": "id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "yclients_id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "name",
					"data_type": "text",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "phone",
					"data_type": "text",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "raw_phone",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "email",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "discount",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "company_id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "branch_ids",
					"data_type": "ARRAY",
					"is_nullable": "YES",
					"column_default": "'{}'::bigint[]",
					"comment": null
				},
				{
					"column_name": "tags",
					"data_type": "ARRAY",
					"is_nullable": "YES",
					"column_default": "'{}'::text[]",
					"comment": null
				},
				{
					"column_name": "status",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "source",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": "'yclients'::text",
					"comment": null
				},
				{
					"column_name": "created_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "updated_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "visit_count",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "total_spent",
					"data_type": "numeric",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "first_visit_date",
					"data_type": "date",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "last_visit_date",
					"data_type": "date",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "last_services",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'[]'::jsonb",
					"comment": null
				},
				{
					"column_name": "visit_history",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'[]'::jsonb",
					"comment": null
				},
				{
					"column_name": "preferences",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'{}'::jsonb",
					"comment": null
				},
				{
					"column_name": "last_sync_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "loyalty_level",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": "'Bronze'::text",
					"comment": null
				},
				{
					"column_name": "client_segment",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": "'New'::text",
					"comment": null
				},
				{
					"column_name": "average_bill",
					"data_type": "numeric",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "last_service_ids",
					"data_type": "ARRAY",
					"is_nullable": "YES",
					"column_default": "'{}'::integer[]",
					"comment": null
				},
				{
					"column_name": "favorite_staff_ids",
					"data_type": "ARRAY",
					"is_nullable": "YES",
					"column_default": "'{}'::integer[]",
					"comment": null
				},
				{
					"column_name": "preferred_time_slots",
					"data_type": "ARRAY",
					"is_nullable": "YES",
					"column_default": "'{}'::text[]",
					"comment": null
				},
				{
					"column_name": "blacklisted",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "false",
					"comment": null
				},
				{
					"column_name": "notes",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "created_by_ai",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "false",
					"comment": "Был ли клиент создан через AI-администратора"
				},
				{
					"column_name": "last_ai_interaction",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": null,
					"comment": "Время последнего взаимодействия с AI"
				},
				{
					"column_name": "ai_context",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'{}'::jsonb",
					"comment": "Контекст AI диалога: стиль общения, предпочтения, паттерны"
				},
				{
					"column_name": "ai_messages_count",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": "Количество сообщений в AI диалогах"
				},
				{
					"column_name": "ai_satisfaction_score",
					"data_type": "numeric",
					"is_nullable": "YES",
					"column_default": "NULL::numeric",
					"comment": "Оценка удовлетворенности AI сервисом (1-5)"
				}
			]
		},
		{
			"table_name": "dialog_contexts",
			"table_comment": null,
			"columns": [
				{
					"column_name": "id",
					"data_type": "uuid",
					"is_nullable": "NO",
					"column_default": "gen_random_uuid()",
					"comment": null
				},
				{
					"column_name": "user_id",
					"data_type": "text",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "state",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": "'''INIT'''::text",
					"comment": null
				},
				{
					"column_name": "data",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'{}'::jsonb",
					"comment": null
				},
				{
					"column_name": "messages",
					"data_type": "jsonb",
					"is_nullable": "NO",
					"column_default": "'[]'::jsonb",
					"comment": null
				},
				{
					"column_name": "created_at",
					"data_type": "timestamp with time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "updated_at",
					"data_type": "timestamp with time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "client_id",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "company_id",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "last_activity",
					"data_type": "timestamp with time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "message_count",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "last_booking_id",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "session_type",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": "'chat'::text",
					"comment": null
				},
				{
					"column_name": "context_metadata",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'{}'::jsonb",
					"comment": null
				}
			]
		},
		{
			"table_name": "services",
			"table_comment": "Кэш услуг из Yclients для минимизации API вызовов",
			"columns": [
				{
					"column_name": "id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": "nextval('services_id_seq'::regclass)",
					"comment": null
				},
				{
					"column_name": "yclients_id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": "ID услуги в системе Yclients"
				},
				{
					"column_name": "company_id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "title",
					"data_type": "text",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "category_id",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "category_title",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "price_min",
					"data_type": "numeric",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "price_max",
					"data_type": "numeric",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "discount",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "duration",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "seance_length",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "is_active",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "true",
					"comment": null
				},
				{
					"column_name": "is_bookable",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "true",
					"comment": null
				},
				{
					"column_name": "description",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "weight",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "created_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "updated_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "last_sync_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "raw_data",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'{}'::jsonb",
					"comment": null
				},
				{
					"column_name": "image_url",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				}
			]
		},
		{
			"table_name": "staff_schedules",
			"table_comment": "Кэш расписания работы мастеров (без слотов)",
			"columns": [
				{
					"column_name": "id",
					"data_type": "integer",
					"is_nullable": "NO",
					"column_default": "nextval('staff_schedules_id_seq'::regclass)",
					"comment": null
				},
				{
					"column_name": "staff_id",
					"data_type": "integer",
					"is_nullable": "NO",
					"column_default": null,
					"comment": "ID мастера из Yclients API"
				},
				{
					"column_name": "staff_name",
					"data_type": "character varying",
					"is_nullable": "NO",
					"column_default": null,
					"comment": "Имя мастера для быстрого доступа"
				},
				{
					"column_name": "date",
					"data_type": "date",
					"is_nullable": "NO",
					"column_default": null,
					"comment": "Дата работы"
				},
				{
					"column_name": "is_working",
					"data_type": "boolean",
					"is_nullable": "NO",
					"column_default": "false",
					"comment": "Работает ли мастер в этот день"
				},
				{
					"column_name": "work_start",
					"data_type": "time without time zone",
					"is_nullable": "YES",
					"column_default": null,
					"comment": "Время начала работы"
				},
				{
					"column_name": "work_end",
					"data_type": "time without time zone",
					"is_nullable": "YES",
					"column_default": null,
					"comment": "Время окончания работы"
				},
				{
					"column_name": "working_hours",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": null,
					"comment": "Детальная информация о рабочих часах (JSON)"
				},
				{
					"column_name": "last_updated",
					"data_type": "timestamp without time zone",
					"is_nullable": "NO",
					"column_default": "CURRENT_TIMESTAMP",
					"comment": "Время последнего обновления записи"
				},
				{
					"column_name": "has_booking_slots",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "false",
					"comment": "Whether the staff member has available booking slots on this date (from YClients booking_dates)"
				}
			]
		},
		{
			"table_name": "staff",
			"table_comment": "Кэш мастеров из Yclients с рейтингами и специализациями",
			"columns": [
				{
					"column_name": "id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": "nextval('staff_id_seq'::regclass)",
					"comment": null
				},
				{
					"column_name": "yclients_id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "company_id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "name",
					"data_type": "text",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "specialization",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "position",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "is_active",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "true",
					"comment": null
				},
				{
					"column_name": "is_bookable",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "true",
					"comment": null
				},
				{
					"column_name": "rating",
					"data_type": "numeric",
					"is_nullable": "YES",
					"column_default": null,
					"comment": "Рейтинг мастера от 0.00 до 5.00"
				},
				{
					"column_name": "votes_count",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "comments_count",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "avatar_url",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "information",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "service_ids",
					"data_type": "ARRAY",
					"is_nullable": "YES",
					"column_default": "'{}'::integer[]",
					"comment": null
				},
				{
					"column_name": "email",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "phone",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "telegram",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "experience_years",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "level_name",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "created_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "updated_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "last_sync_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "raw_data",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'{}'::jsonb",
					"comment": null
				}
			]
		},
		{
			"table_name": "appointments_cache",
			"table_comment": "Кэш записей для анализа паттернов клиентов без обращения к API",
			"columns": [
				{
					"column_name": "id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": "nextval('appointments_cache_id_seq'::regclass)",
					"comment": null
				},
				{
					"column_name": "yclients_record_id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "client_id",
					"data_type": "bigint",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "company_id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "service_id",
					"data_type": "bigint",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "staff_id",
					"data_type": "bigint",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "appointment_datetime",
					"data_type": "timestamp without time zone",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "status",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": "'confirmed'::text",
					"comment": null
				},
				{
					"column_name": "cost",
					"data_type": "numeric",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "paid_amount",
					"data_type": "numeric",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "attendance",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": "0=ожидает, 1=пришел, -1=не пришел, 2=отменено"
				},
				{
					"column_name": "visit_length",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "comment",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "staff_comment",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "is_cancelled",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "false",
					"comment": null
				},
				{
					"column_name": "cancellation_reason",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "rescheduled_from_id",
					"data_type": "bigint",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "sms_before",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "email_before",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "created_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "updated_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "synced_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "raw_data",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'{}'::jsonb",
					"comment": null
				}
			]
		},
		{
			"table_name": "sync_status",
			"table_comment": "Отслеживание статуса синхронизации данных с Yclients",
			"columns": [
				{
					"column_name": "id",
					"data_type": "integer",
					"is_nullable": "NO",
					"column_default": "nextval('sync_status_id_seq'::regclass)",
					"comment": null
				},
				{
					"column_name": "table_name",
					"data_type": "text",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "company_id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "last_sync_at",
					"data_type": "timestamp without time zone",
					"is_nullable": "YES",
					"column_default": "now()",
					"comment": null
				},
				{
					"column_name": "sync_status",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": "'pending'::text",
					"comment": null
				},
				{
					"column_name": "records_processed",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": "0",
					"comment": null
				},
				{
					"column_name": "error_message",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "sync_duration_ms",
					"data_type": "integer",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				}
			]
		},
		{
			"table_name": "companies",
			"table_comment": null,
			"columns": [
				{
					"column_name": "id",
					"data_type": "integer",
					"is_nullable": "NO",
					"column_default": "nextval('companies_id_seq'::regclass)",
					"comment": null
				},
				{
					"column_name": "company_id",
					"data_type": "bigint",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "yclients_id",
					"data_type": "bigint",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "title",
					"data_type": "text",
					"is_nullable": "NO",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "address",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "phone",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "email",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "website",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "timezone",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": "'Europe/Moscow'::text",
					"comment": null
				},
				{
					"column_name": "working_hours",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "coordinate_lat",
					"data_type": "numeric",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "coordinate_lon",
					"data_type": "numeric",
					"is_nullable": "YES",
					"column_default": null,
					"comment": null
				},
				{
					"column_name": "currency",
					"data_type": "text",
					"is_nullable": "YES",
					"column_default": "'RUB'::text",
					"comment": null
				},
				{
					"column_name": "ai_enabled",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "true",
					"comment": null
				},
				{
					"column_name": "sync_enabled",
					"data_type": "boolean",
					"is_nullable": "YES",
					"column_default": "true",
					"comment": null
				},
				{
					"column_name": "created_at",
					"data_type": "timestamp with time zone",
					"is_nullable": "YES",
					"column_default": "CURRENT_TIMESTAMP",
					"comment": null
				},
				{
					"column_name": "updated_at",
					"data_type": "timestamp with time zone",
					"is_nullable": "YES",
					"column_default": "CURRENT_TIMESTAMP",
					"comment": null
				},
				{
					"column_name": "last_sync_at",
					"data_type": "timestamp with time zone",
					"is_nullable": "YES",
					"column_default": "CURRENT_TIMESTAMP",
					"comment": null
				},
				{
					"column_name": "raw_data",
					"data_type": "jsonb",
					"is_nullable": "YES",
					"column_default": "'{}'::jsonb",
					"comment": null
				}
			]
		}
	]
}