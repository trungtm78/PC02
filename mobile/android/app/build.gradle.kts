plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "vn.gov.pc02.mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "vn.gov.pc02.mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            val ksPath = System.getenv("MOBILE_KEYSTORE_PATH")
            val ksPass = System.getenv("MOBILE_KEYSTORE_PASSWORD")
            val ksAlias = System.getenv("MOBILE_KEY_ALIAS")
            if (ksPath.isNullOrBlank() || ksPass.isNullOrBlank() || ksAlias.isNullOrBlank()) {
                // Secrets missing → fall back to debug keystore so `flutter run`
                // and local dev keep working. CI release builds MUST set all
                // three env vars; mobile-build.yml fails the job if they're
                // empty before invoking flutter build.
                println("⚠️  Release signing secrets missing; falling back to debug keystore (OK for local dev).")
            } else {
                keyAlias = ksAlias
                keyPassword = ksPass
                storeFile = file(ksPath)
                storePassword = ksPass
            }
        }
    }

    buildTypes {
        release {
            val ksPath = System.getenv("MOBILE_KEYSTORE_PATH")
            signingConfig = if (ksPath.isNullOrBlank()) {
                signingConfigs.getByName("debug")
            } else {
                signingConfigs.getByName("release")
            }
            isMinifyEnabled = true
            isShrinkResources = true
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.2")
}

flutter {
    source = "../.."
}
