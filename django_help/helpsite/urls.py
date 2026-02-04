from django.urls import path, include

urlpatterns = [
    path('help/', include('helpcenter.urls')),
]
