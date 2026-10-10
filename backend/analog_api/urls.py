# analog_api/urls.py
from django.urls import path
from .views import AnalogMatcherAPI

urlpatterns = [
    path('match/', AnalogMatcherAPI.as_view(), name='analog_match'),
]