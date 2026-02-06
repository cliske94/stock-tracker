from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='help_index'),
    path('health/', views.health, name='health'),
    path('metrics/', views.metrics, name='metrics'),
    path('api-spec/', views.api_spec, name='api_spec'),
    path('<slug:slug>/', views.page, name='help_page'),
]
