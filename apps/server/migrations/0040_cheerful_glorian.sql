ALTER TABLE `users` ADD `profile_page_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_profile_page_id_unique` ON `users` (`profile_page_id`);