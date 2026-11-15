CREATE TABLE `global_group_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_user_id` text,
	`role_id` text,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `global_group_audit_group_idx` ON `global_group_audit` (`group_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `global_group_member_roles` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`, `role_id`),
	FOREIGN KEY (`role_id`) REFERENCES `global_group_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `global_group_member_roles_user_idx` ON `global_group_member_roles` (`user_id`);--> statement-breakpoint
CREATE TABLE `global_group_members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `global_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `global_group_members_user_idx` ON `global_group_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `global_group_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `global_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `global_group_roles_group_idx` ON `global_group_roles` (`group_id`);--> statement-breakpoint
CREATE TABLE `global_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text,
	`color` text,
	`page_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `global_groups_position_idx` ON `global_groups` (`position`);