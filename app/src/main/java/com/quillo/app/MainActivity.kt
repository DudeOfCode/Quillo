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
import android.provider.DocumentsContract
import org.json.JSONObject
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.view.ActionMode
import android.view.View
import android.view.MenuItem
import android.view.Menu
import android.graphics.Rect
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

        // Quillo draws its own text menu. Android's built-in one is emptied (NOT cancelled):
        // cancelling the action mode makes WebView clear the selection, which broke text selection.
        web = object : WebView(this) {
            private fun hideMenu(cb: ActionMode.Callback?): ActionMode.Callback? {
                if (cb == null) return null
                return object : ActionMode.Callback2() {
                    override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
                        val ok = cb.onCreateActionMode(mode, menu); menu.clear(); return ok
                    }
                    override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean {
                        cb.onPrepareActionMode(mode, menu); menu.clear(); return true
                    }
                    override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean =
                        cb.onActionItemClicked(mode, item)
                    override fun onDestroyActionMode(mode: ActionMode) = cb.onDestroyActionMode(mode)
                    override fun onGetContentRect(mode: ActionMode, view: View, outRect: Rect) {
                        if (cb is ActionMode.Callback2) cb.onGetContentRect(mode, view, outRect)
                        else super.onGetContentRect(mode, view, outRect)
                    }
                }
            }
            override fun startActionMode(callback: ActionMode.Callback?): ActionMode? =
                super.startActionMode(hideMenu(callback))
            override fun startActionMode(callback: ActionMode.Callback?, type: Int): ActionMode? =
                super.startActionMode(hideMenu(callback), type)
        }
        setContentView(web)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            textZoom = 100
            minimumFontSize = 1
            minimumLogicalFontSize = 1
            layoutAlgorithm = WebSettings.LayoutAlgorithm.NORMAL
            mediaPlaybackRequiresUserGesture = false
        }

        web.addJavascriptInterface(SaverBridge(), "AndroidSaver")

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView, request: WebResourceRequest
            ): WebResourceResponse? {
                val r = assetLoader.shouldInterceptRequest(request.url)
                val path = request.url.path ?: ""
                if (r != null) when {
                    path.endsWith(".woff2") -> r.mimeType = "font/woff2"
                    path.endsWith(".js") -> r.mimeType = "text/javascript"
                }
                return r
            }

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
        if (requestCode == REQ_SAVEAS) {
            val b = asBytes; asBytes = null; val u = data?.data
            if (resultCode == Activity.RESULT_OK && u != null && b != null) {
                try { contentResolver.openOutputStream(u, "wt")?.use { it.write(b) }; toast("Saved") }
                catch (e: Exception) { toast("Save failed: ${e.message}") }
            } else toast("Save cancelled")
            return
        }
        if (requestCode == REQ_TREE) {
            val u = data?.data
            if (resultCode == Activity.RESULT_OK && u != null) {
                try {
                    contentResolver.takePersistableUriPermission(u,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                } catch (e: Exception) { }
                prefs.edit().putString("tree", u.toString()).apply()
                notifyFolder(); toast("Save folder: " + folderLabel())
            }
            return
        }
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
        fun saveAs(base64: String, filename: String, mime: String) {
            val bytes = try { Base64.decode(base64, Base64.DEFAULT) } catch (e: Exception) {
                runOnUiThread { toast("Could not read the file") }; return }
            val name = sanitize(filename)
            val mt = if (mime.isNotBlank()) mime else mimeForExt(name.substringAfterLast('.', ""))
            runOnUiThread {
                asBytes = bytes
                val i = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mt
                    putExtra(Intent.EXTRA_TITLE, name)
                    treeUri()?.let { putExtra(DocumentsContract.EXTRA_INITIAL_URI, it) }
                }
                try { startActivityForResult(i, REQ_SAVEAS) } catch (e: Exception) { asBytes = null; toast("No file picker available") }
            }
        }

        @JavascriptInterface
        fun chooseFolder() = runOnUiThread {
            val i = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            try { startActivityForResult(i, REQ_TREE) } catch (e: Exception) { toast("No folder picker available") }
        }

        @JavascriptInterface
        fun resetFolder() = runOnUiThread {
            prefs.edit().remove("tree").apply(); notifyFolder(); toast("Using Downloads/Quillo")
        }

        @JavascriptInterface
        fun getFolder(): String = folderLabel()

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
            runOnUiThread { saveDefault(bytes, name, type) }
        }
    }

    private var asBytes: ByteArray? = null
    private val prefs by lazy { getSharedPreferences("quillo", MODE_PRIVATE) }
    private fun treeUri(): Uri? = prefs.getString("tree", null)?.let { Uri.parse(it) }

    private fun folderLabel(): String {
        val t = treeUri() ?: return "Downloads/Quillo"
        return try {
            DocumentsContract.getTreeDocumentId(t).replaceFirst("primary:", "Internal storage/").replace(":", "/")
        } catch (e: Exception) { "Custom folder" }
    }

    private fun notifyFolder() {
        web.evaluateJavascript("window.onFolder&&window.onFolder(" + JSONObject.quote(folderLabel()) + ")", null)
    }

    private fun saveDefault(bytes: ByteArray, name: String, mime: String) {
        val t = treeUri()
        if (t != null) {
            try {
                val parent = DocumentsContract.buildDocumentUriUsingTree(t, DocumentsContract.getTreeDocumentId(t))
                val doc = DocumentsContract.createDocument(contentResolver, parent, mime, name)
                if (doc != null) {
                    contentResolver.openOutputStream(doc)?.use { it.write(bytes) }
                    toast("Saved to ${folderLabel()}/$name")
                    return
                }
            } catch (e: Exception) { /* fall through to Downloads */ }
            toast("Chosen folder unavailable – saving to Downloads/Quillo")
        }
        saveToDownloads(bytes, name, mime)
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
        n.ifBlank { "document" }.map { c -> if (c == '\\' || c == '"' || c in "/:*?<>|") '_' else c }.joinToString("")

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
        private const val REQ_SAVEAS = 1003
        private const val REQ_TREE = 1004

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
