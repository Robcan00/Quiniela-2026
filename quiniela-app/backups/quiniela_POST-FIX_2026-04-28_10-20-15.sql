


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'player'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_prediction_user_id_from_entry"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_owner_user_id uuid;
begin
  if new.entry_id is null then
    raise exception 'prediction requires entry_id';
  end if;

  select e.owner_user_id
  into v_owner_user_id
  from public.entries e
  where e.id = new.entry_id;

  if v_owner_user_id is null then
    raise exception 'entry % does not exist or has no owner_user_id', new.entry_id;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_owner_user_id
  ) then
    raise exception 'entry % resolves to owner_user_id % but no matching profile exists',
      new.entry_id, v_owner_user_id;
  end if;

  new.user_id := v_owner_user_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_prediction_user_id_from_entry"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quiniela_id" "uuid" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text",
    "email" "text" NOT NULL,
    "entry_number" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entries_backup_20260421" (
    "id" "uuid",
    "quiniela_id" "uuid",
    "owner_user_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "email" "text",
    "entry_number" integer,
    "is_active" boolean,
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."entries_backup_20260421" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stage" "text" DEFAULT 'group'::"text" NOT NULL,
    "group_name" "text",
    "match_number" integer,
    "home_team" "text" NOT NULL,
    "away_team" "text" NOT NULL,
    "home_flag_url" "text",
    "away_flag_url" "text",
    "kickoff_at" timestamp with time zone NOT NULL,
    "home_score_actual" integer,
    "away_score_actual" integer,
    "is_open" boolean DEFAULT true NOT NULL,
    "is_finished" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "home_score" integer,
    "away_score" integer
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "match_id" "uuid" NOT NULL,
    "home_score_predicted" integer NOT NULL,
    "away_score_predicted" integer NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    CONSTRAINT "predictions_away_score_predicted_check" CHECK (("away_score_predicted" >= 0)),
    CONSTRAINT "predictions_home_score_predicted_check" CHECK (("home_score_predicted" >= 0))
);


ALTER TABLE "public"."predictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'player'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."leaderboard" AS
 WITH "scored" AS (
         SELECT "p"."user_id",
            COALESCE("pr"."full_name", 'Participante'::"text") AS "full_name",
            "p"."match_id",
            "p"."home_score_predicted",
            "p"."away_score_predicted",
            "m"."home_score",
            "m"."away_score",
                CASE
                    WHEN (("m"."home_score" IS NULL) OR ("m"."away_score" IS NULL)) THEN 0
                    WHEN (("p"."home_score_predicted" = "m"."home_score") AND ("p"."away_score_predicted" = "m"."away_score")) THEN 3
                    WHEN ((("p"."home_score_predicted" > "p"."away_score_predicted") AND ("m"."home_score" > "m"."away_score")) OR (("p"."home_score_predicted" < "p"."away_score_predicted") AND ("m"."home_score" < "m"."away_score")) OR (("p"."home_score_predicted" = "p"."away_score_predicted") AND ("m"."home_score" = "m"."away_score"))) THEN 1
                    ELSE 0
                END AS "points",
                CASE
                    WHEN (("m"."home_score" IS NULL) OR ("m"."away_score" IS NULL)) THEN 0
                    WHEN (("p"."home_score_predicted" = "m"."home_score") AND ("p"."away_score_predicted" = "m"."away_score")) THEN 1
                    ELSE 0
                END AS "exact_hit",
                CASE
                    WHEN (("m"."home_score" IS NULL) OR ("m"."away_score" IS NULL)) THEN 0
                    WHEN ((("p"."home_score_predicted" > "p"."away_score_predicted") AND ("m"."home_score" > "m"."away_score")) OR (("p"."home_score_predicted" < "p"."away_score_predicted") AND ("m"."home_score" < "m"."away_score")) OR (("p"."home_score_predicted" = "p"."away_score_predicted") AND ("m"."home_score" = "m"."away_score"))) THEN 1
                    ELSE 0
                END AS "outcome_hit"
           FROM (("public"."predictions" "p"
             JOIN "public"."matches" "m" ON (("m"."id" = "p"."match_id")))
             LEFT JOIN "public"."profiles" "pr" ON (("pr"."id" = "p"."user_id")))
        )
 SELECT "user_id",
    "full_name",
    "sum"("points") AS "total_points",
    "sum"("exact_hit") AS "exact_hits",
    "sum"("outcome_hit") AS "outcome_hits"
   FROM "scored"
  GROUP BY "user_id", "full_name"
  ORDER BY ("sum"("points")) DESC, ("sum"("exact_hit")) DESC, ("sum"("outcome_hit")) DESC;


ALTER VIEW "public"."leaderboard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quinielas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quinielas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."leaderboard_entries" AS
 SELECT "e"."id" AS "entry_id",
    "e"."owner_user_id",
    "e"."quiniela_id",
    "q"."name" AS "quiniela_name",
    "e"."entry_number",
    TRIM(BOTH FROM "concat"("e"."first_name", ' ', "e"."last_name")) AS "participant_name",
    COALESCE("sum"(
        CASE
            WHEN (("m"."home_score" IS NOT NULL) AND ("m"."away_score" IS NOT NULL) AND ("p"."home_score_predicted" = "m"."home_score") AND ("p"."away_score_predicted" = "m"."away_score")) THEN 3
            WHEN (("m"."home_score" IS NOT NULL) AND ("m"."away_score" IS NOT NULL) AND ((("p"."home_score_predicted" > "p"."away_score_predicted") AND ("m"."home_score" > "m"."away_score")) OR (("p"."home_score_predicted" < "p"."away_score_predicted") AND ("m"."home_score" < "m"."away_score")) OR (("p"."home_score_predicted" = "p"."away_score_predicted") AND ("m"."home_score" = "m"."away_score"))) AND (NOT (("p"."home_score_predicted" = "m"."home_score") AND ("p"."away_score_predicted" = "m"."away_score")))) THEN 1
            ELSE 0
        END), (0)::bigint) AS "total_points",
    COALESCE("sum"(
        CASE
            WHEN (("m"."home_score" IS NOT NULL) AND ("m"."away_score" IS NOT NULL) AND ("p"."home_score_predicted" = "m"."home_score") AND ("p"."away_score_predicted" = "m"."away_score")) THEN 1
            ELSE 0
        END), (0)::bigint) AS "exact_hits",
    COALESCE("sum"(
        CASE
            WHEN (("m"."home_score" IS NOT NULL) AND ("m"."away_score" IS NOT NULL) AND ((("p"."home_score_predicted" > "p"."away_score_predicted") AND ("m"."home_score" > "m"."away_score")) OR (("p"."home_score_predicted" < "p"."away_score_predicted") AND ("m"."home_score" < "m"."away_score")) OR (("p"."home_score_predicted" = "p"."away_score_predicted") AND ("m"."home_score" = "m"."away_score"))) AND (NOT (("p"."home_score_predicted" = "m"."home_score") AND ("p"."away_score_predicted" = "m"."away_score")))) THEN 1
            ELSE 0
        END), (0)::bigint) AS "outcome_hits"
   FROM ((("public"."entries" "e"
     LEFT JOIN "public"."quinielas" "q" ON (("q"."id" = "e"."quiniela_id")))
     LEFT JOIN "public"."predictions" "p" ON (("p"."entry_id" = "e"."id")))
     LEFT JOIN "public"."matches" "m" ON (("m"."id" = "p"."match_id")))
  WHERE ("e"."is_active" = true)
  GROUP BY "e"."id", "e"."owner_user_id", "e"."quiniela_id", "q"."name", "e"."entry_number", "e"."first_name", "e"."last_name";


ALTER VIEW "public"."leaderboard_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches_backup_20260421" (
    "id" "uuid",
    "stage" "text",
    "group_name" "text",
    "match_number" integer,
    "home_team" "text",
    "away_team" "text",
    "home_flag_url" "text",
    "away_flag_url" "text",
    "kickoff_at" timestamp with time zone,
    "home_score_actual" integer,
    "away_score_actual" integer,
    "is_open" boolean,
    "is_finished" boolean,
    "created_at" timestamp with time zone,
    "home_score" integer,
    "away_score" integer
);


ALTER TABLE "public"."matches_backup_20260421" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."predictions_backup_20260421" (
    "id" "uuid",
    "user_id" "uuid",
    "match_id" "uuid",
    "home_score_predicted" integer,
    "away_score_predicted" integer,
    "submitted_at" timestamp with time zone,
    "is_locked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."predictions_backup_20260421" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles_backup_20260421" (
    "id" "uuid",
    "full_name" "text",
    "email" "text",
    "role" "text",
    "created_at" timestamp with time zone,
    "first_name" "text",
    "last_name" "text",
    "phone" "text"
);


ALTER TABLE "public"."profiles_backup_20260421" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."score_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "match_id" "uuid" NOT NULL,
    "points_awarded" integer DEFAULT 0 NOT NULL,
    "exact_hit" boolean DEFAULT false NOT NULL,
    "outcome_hit" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "score_entries_points_awarded_check" CHECK ((("points_awarded" >= 0) AND ("points_awarded" <= 3)))
);


ALTER TABLE "public"."score_entries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."predictions"
    ADD CONSTRAINT "predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quinielas"
    ADD CONSTRAINT "quinielas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quinielas"
    ADD CONSTRAINT "quinielas_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."score_entries"
    ADD CONSTRAINT "score_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."score_entries"
    ADD CONSTRAINT "score_entries_user_id_match_id_key" UNIQUE ("user_id", "match_id");



CREATE INDEX "idx_entries_email" ON "public"."entries" USING "btree" ("email");



CREATE INDEX "idx_entries_owner_user_id" ON "public"."entries" USING "btree" ("owner_user_id");



CREATE INDEX "idx_entries_quiniela_id" ON "public"."entries" USING "btree" ("quiniela_id");



CREATE INDEX "idx_matches_kickoff_at" ON "public"."matches" USING "btree" ("kickoff_at");



CREATE INDEX "idx_predictions_match_id" ON "public"."predictions" USING "btree" ("match_id");



CREATE INDEX "idx_predictions_user_id" ON "public"."predictions" USING "btree" ("user_id");



CREATE INDEX "idx_score_entries_match_id" ON "public"."score_entries" USING "btree" ("match_id");



CREATE INDEX "idx_score_entries_user_id" ON "public"."score_entries" USING "btree" ("user_id");



CREATE INDEX "predictions_entry_id_idx" ON "public"."predictions" USING "btree" ("entry_id");



CREATE INDEX "predictions_entry_match_idx" ON "public"."predictions" USING "btree" ("entry_id", "match_id");



CREATE UNIQUE INDEX "predictions_entry_match_unique" ON "public"."predictions" USING "btree" ("entry_id", "match_id");



CREATE INDEX "predictions_match_id_idx" ON "public"."predictions" USING "btree" ("match_id");



CREATE UNIQUE INDEX "uq_entries_quiniela_owner_entry_number" ON "public"."entries" USING "btree" ("quiniela_id", "owner_user_id", "entry_number");



CREATE OR REPLACE TRIGGER "set_predictions_updated_at" BEFORE UPDATE ON "public"."predictions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_prediction_user_id_from_entry" BEFORE INSERT OR UPDATE ON "public"."predictions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_prediction_user_id_from_entry"();



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_quiniela_id_fkey" FOREIGN KEY ("quiniela_id") REFERENCES "public"."quinielas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."predictions"
    ADD CONSTRAINT "predictions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."predictions"
    ADD CONSTRAINT "predictions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."predictions"
    ADD CONSTRAINT "predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."score_entries"
    ADD CONSTRAINT "score_entries_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."score_entries"
    ADD CONSTRAINT "score_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Allow read matches" ON "public"."matches" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow read quinielas" ON "public"."quinielas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow update matches" ON "public"."matches" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view quinielas" ON "public"."quinielas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can insert own entries" ON "public"."entries" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own entries" ON "public"."entries" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own entries" ON "public"."entries" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entries_backup_20260421" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches_backup_20260421" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."predictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."predictions_backup_20260421" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "predictions_dev_all" ON "public"."predictions" TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles_backup_20260421" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."quinielas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."score_entries" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_prediction_user_id_from_entry"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_prediction_user_id_from_entry"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_prediction_user_id_from_entry"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."entries" TO "anon";
GRANT ALL ON TABLE "public"."entries" TO "authenticated";
GRANT ALL ON TABLE "public"."entries" TO "service_role";



GRANT ALL ON TABLE "public"."entries_backup_20260421" TO "anon";
GRANT ALL ON TABLE "public"."entries_backup_20260421" TO "authenticated";
GRANT ALL ON TABLE "public"."entries_backup_20260421" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."predictions" TO "anon";
GRANT ALL ON TABLE "public"."predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."predictions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."leaderboard" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard" TO "service_role";



GRANT ALL ON TABLE "public"."quinielas" TO "anon";
GRANT ALL ON TABLE "public"."quinielas" TO "authenticated";
GRANT ALL ON TABLE "public"."quinielas" TO "service_role";



GRANT ALL ON TABLE "public"."leaderboard_entries" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_entries" TO "service_role";



GRANT ALL ON TABLE "public"."matches_backup_20260421" TO "anon";
GRANT ALL ON TABLE "public"."matches_backup_20260421" TO "authenticated";
GRANT ALL ON TABLE "public"."matches_backup_20260421" TO "service_role";



GRANT ALL ON TABLE "public"."predictions_backup_20260421" TO "anon";
GRANT ALL ON TABLE "public"."predictions_backup_20260421" TO "authenticated";
GRANT ALL ON TABLE "public"."predictions_backup_20260421" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_backup_20260421" TO "anon";
GRANT ALL ON TABLE "public"."profiles_backup_20260421" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_backup_20260421" TO "service_role";



GRANT ALL ON TABLE "public"."score_entries" TO "anon";
GRANT ALL ON TABLE "public"."score_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."score_entries" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































