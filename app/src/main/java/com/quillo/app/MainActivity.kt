package com.quillo.app

import android.Manifest
import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    // Data parked for a pending pre-Q save that needs the storage permission.
    private var pendingBytes: ByteArray? = null
    private var pendingName: String? = null
    private var pendingMime: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        setContentView(web)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            mediaPlaybackRequiresUserGesture = false
        }

        web.addJavascriptInterface(SaverBridge(), "AndroidSaver")

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView, request: WebResourceRequest
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

            override fun onPageFinished(view: WebView, url: String) {
                view.evaluateJavascript(BLOB_HOOK, null)
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                val intent = params.createIntent()
                // Honour accept types declared by <input accept="..."> (.docx / image/*)
                val accept = params.acceptTypes?.filter { it.isNotBlank() }
                if (!accept.isNullOrEmpty()) {
                    intent.type = "*/*"
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, resolveMimes(accept))
                }
                return try {
                    startActivityForResult(Intent.createChooser(intent, "Select file"), REQ_FILE)
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    false
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else finish()
            }
        })

        if (savedInstanceState == null) {
            web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        } else {
            web.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    private fun resolveMimes(accept: List<String>): Array<String> = accept.map {
        when {
            it.startsWith(".") -> mimeForExt(it.removePrefix("."))
            else -> it
        }
    }.toTypedArray()

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQ_FILE) {
            val cb = fileCallback
            fileCallback = null
            val result: Array<Uri>? = if (resultCode == Activity.RESULT_OK && data != null) {
                data.data?.let { arrayOf(it) }
            } else null
            cb?.onReceiveValue(result)
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    /** Bridge the web app calls to hand a generated file (docx / pdf) back to Android. */
    inner class SaverBridge {
        @JavascriptInterface
        fun saveBase64(base64: String, filename: String, mime: String) {
            val bytes = try {
                Base64.decode(base64, Base64.DEFAULT)
            } catch (e: Exception) {
                runOnUiThread { toast("Could not read the file") }
                return
            }
            val name = sanitize(filename)
            val type = if (mime.isNotBlank()) mime else mimeForExt(name.substringAfterLast('.', ""))
            runOnUiThread { saveToDownloads(bytes, name, type) }
        }
    }

    private fun saveToDownloads(bytes: ByteArray, name: String, mime: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, name)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Quillo")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: run { toast("Save failed"); return }
                resolver.openOutputStream(uri)?.use { it.write(bytes) }
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
                toast("Saved to Downloads/Quillo/$name")
            } catch (e: Exception) {
                toast("Save failed: ${e.message}")
            }
        } else {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
                pendingBytes = bytes; pendingName = name; pendingMime = mime
                ActivityCompat.requestPermissions(
                    this, arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), REQ_PERM)
                return
            }
            writeLegacy(bytes, name)
        }
    }

    private fun writeLegacy(bytes: ByteArray, name: String) {
        try {
            @Suppress("DEPRECATION")
            val dir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "Quillo"
            )
            if (!dir.exists()) dir.mkdirs()
            val out = File(dir, name)
            FileOutputStream(out).use { it.write(bytes) }
            toast("Saved to Download/Quillo/$name")
        } catch (e: Exception) {
            toast("Save failed: ${e.message}")
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_PERM) {
            val b = pendingBytes; val n = pendingName
            pendingBytes = null; pendingName = null; pendingMime = null
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
                && b != null && n != null) {
                writeLegacy(b, n)
            } else {
                toast("Storage permission is needed to save the file")
            }
        }
    }

    private fun sanitize(n: String): String =
        n.ifBlank { "document" }.replace(Regex("[\\\\/:*?\"<>|]"), "_")

    private fun mimeForExt(ext: String): String = when (ext.lowercase()) {
        "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        "pdf" -> "application/pdf"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        else -> "application/octet-stream"
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    companion object {
        private const val REQ_FILE = 1001
        private const val REQ_PERM = 1002

        // Intercepts the editor's blob-based download links (Save .docx / Export PDF)
        // and routes the bytes to Android so they land in the Downloads folder.
        private const val BLOB_HOOK = """
(function(){
  if (window.__quilloHook) return; window.__quilloHook = true;
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('blob:') !== 0 && href.indexOf('data:') !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var name = a.getAttribute('download') || 'document';
    fetch(href).then(function(r){ return r.blob(); }).then(function(b){
      var fr = new FileReader();
      fr.onload = function(){
        var d = String(fr.result); var i = d.indexOf(',');
        try { AndroidSaver.saveBase64(d.substring(i + 1), name, b.type || ''); } catch (err) {}
      };
      fr.readAsDataURL(b);
    }).catch(function(){});
  }, true);
})();
"""
    }
}
