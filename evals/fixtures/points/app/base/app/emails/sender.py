from app.emails.templates import render

OUTBOX = []


def send(to, template, values):
    OUTBOX.append((to, render(template, values)))
