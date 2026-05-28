-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "telegram_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_id" TEXT,
    "username" TEXT,
    "first_name" TEXT,
    "link_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "linked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "AgentRole" NOT NULL,
    "message" TEXT NOT NULL,
    "intent" TEXT,
    "action_taken" TEXT,
    "success" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_user_id_key" ON "telegram_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_chat_id_key" ON "telegram_accounts"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_link_token_key" ON "telegram_accounts"("link_token");

-- CreateIndex
CREATE INDEX "agent_conversations_user_id_created_at_idx" ON "agent_conversations"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "telegram_accounts" ADD CONSTRAINT "telegram_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
