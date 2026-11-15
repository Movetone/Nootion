PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_global_group_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text,
	`actor_id` text,
	`action` text NOT NULL,
	`target_user_id` text,
	`role_id` text,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_global_group_audit`("id", "group_id", "actor_id", "action", "target_user_id", "role_id", "details", "created_at") SELECT "id", "group_id", "actor_id", "action", "target_user_id", "role_id", "details", "created_at" FROM `global_group_audit`;--> statement-breakpoint
DROP TABLE `global_group_audit`;--> statement-breakpoint
ALTER TABLE `__new_global_group_audit` RENAME TO `global_group_audit`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `global_group_audit_group_idx` ON `global_group_audit` (`group_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `global_group_member_roles` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `global_groups` ADD `archived_at` integer;