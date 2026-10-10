CREATE TYPE "public"."category" AS ENUM('Shoes', 'Bags', 'Accessories');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('incoming', 'outgoing', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('SUPER_ADMIN', 'INVENTORY_KEEPER', 'CASHIER');--> statement-breakpoint
CREATE TYPE "public"."stock_take_status" AS ENUM('in_progress', 'pending_approval', 'approved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."variance_reason" AS ENUM('damage', 'loss', 'count_error');--> statement-breakpoint
CREATE SEQUENCE "public"."intake_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."label_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 100001 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."receipt_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."stock_take_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"detail" text NOT NULL,
	"changes" jsonb
);
--> statement-breakpoint
CREATE TABLE "intake_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"intake_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" "category" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"cost" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"option_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image" "bytea",
	"image_type" text,
	"image_version" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"href" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" uuid NOT NULL,
	"from" date NOT NULL,
	"to" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_number" text DEFAULT 'RC-' || nextval('receipt_number_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cashier_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"tendered" integer NOT NULL,
	"change" integer NOT NULL,
	"idempotency_key" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"store_name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "stock_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text DEFAULT 'INT-' || lpad(nextval('intake_number_seq')::text, 3, '0') NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supplier" text NOT NULL,
	"batch_note" text DEFAULT '' NOT NULL,
	"received_by" uuid NOT NULL,
	CONSTRAINT "stock_intakes_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" "movement_type" NOT NULL,
	"reference" text NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"balance" integer NOT NULL,
	"actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_take_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"take_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"expected" integer NOT NULL,
	"counted" integer,
	"reason" "variance_reason"
);
--> statement-breakpoint
CREATE TABLE "stock_takes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text DEFAULT 'STK-' || lpad(nextval('stock_take_number_seq')::text, 4, '0') NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"date" date NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "stock_take_status" DEFAULT 'in_progress' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	CONSTRAINT "stock_takes_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"password_hash" text NOT NULL,
	"pin_hash" text,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"code" text DEFAULT nextval('label_code_seq')::text NOT NULL,
	"options" json DEFAULT '{}'::json NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"reorder_threshold" integer DEFAULT 3 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "variants_stock_not_negative" CHECK ("variants"."stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_lines" ADD CONSTRAINT "intake_lines_intake_id_stock_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."stock_intakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_intakes" ADD CONSTRAINT "stock_intakes_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_take_lines" ADD CONSTRAINT "stock_take_lines_take_id_stock_takes_id_fk" FOREIGN KEY ("take_id") REFERENCES "public"."stock_takes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "sale_lines_sale_idx" ON "sale_lines" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_receipt_number_key" ON "sales" USING btree ("receipt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_idempotency_key" ON "sales" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "sales_created_at_idx" ON "sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sales_cashier_idx" ON "sales" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "stock_movements_variant_idx" ON "stock_movements" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "stock_movements_at_idx" ON "stock_movements" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "variants_code_key" ON "variants" USING btree ("code");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_id");