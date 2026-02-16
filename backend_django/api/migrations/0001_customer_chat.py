# Generated migration for customer chat

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="CustomerConversation",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("user_id", models.IntegerField(db_index=True, verbose_name="用户ID")),
                ("customer_name", models.CharField(default="客户", max_length=100, verbose_name="客户显示名")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "customer_conversations",
                "managed": True,
                "verbose_name": "客服会话",
                "verbose_name_plural": "客服会话",
            },
        ),
        migrations.CreateModel(
            name="CustomerMessage",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("sender_type", models.CharField(choices=[("customer", "客户"), ("staff", "客服")], max_length=20)),
                ("content", models.TextField(blank=True, default="", verbose_name="内容")),
                ("image", models.CharField(blank=True, max_length=500, null=True, verbose_name="图片URL")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "conversation",
                    models.ForeignKey(
                        db_column="conversation_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="messages",
                        to="api.customerconversation",
                    ),
                ),
            ],
            options={
                "db_table": "customer_messages",
                "managed": True,
                "ordering": ["created_at"],
                "verbose_name": "客服消息",
                "verbose_name_plural": "客服消息",
            },
        ),
    ]
